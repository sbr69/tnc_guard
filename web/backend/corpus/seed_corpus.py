import os
import sys
import csv
import argparse
from google import genai
from google.genai import errors
import psycopg2
from dotenv import load_dotenv

# Load env variables from .env if present
for path in [".env", "backend/.env", "../.env"]:
    if os.path.exists(path):
        load_dotenv(path)
        break

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

def check_env():
    """Verify required environment variables are set."""
    missing = []
    if not GEMINI_API_KEY:
        missing.append("GEMINI_API_KEY")
    if not DATABASE_URL:
        missing.append("DATABASE_URL")
    
    if missing:
        print(f"Error: Missing environment variables: {', '.join(missing)}")
        print("Please check your backend/.env file or set them in your terminal.")
        sys.exit(1)

def get_db_connection():
    """Establishes connection to the Postgres database."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Error connecting to Postgres: {e}")
        sys.exit(1)

def setup_database(cursor):
    """Enables pgvector and sets up all required system tables."""
    print("Ensuring pgvector extension is enabled...")
    cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    
    print("Checking for reference_clauses table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reference_clauses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            text TEXT NOT NULL,
            category TEXT NOT NULL,
            risk_label TEXT NOT NULL,
            explanation TEXT NOT NULL,
            source TEXT NOT NULL,
            embedding vector(3072) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    """)

    print("Checking for documents table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            filename TEXT NOT NULL,
            raw_text TEXT NOT NULL,
            document_type TEXT DEFAULT 'custom',
            status TEXT DEFAULT 'processing',
            health_score INT,
            summary TEXT,
            error_message TEXT,
            processing_time_seconds FLOAT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    """)

    print("Checking for clauses table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS clauses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            doc_id UUID REFERENCES documents(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            section_path TEXT,
            order_index INT NOT NULL,
            char_offset_start INT,
            char_offset_end INT,
            embedding vector(3072)
        );
    """)

    print("Checking for risk_flags table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS risk_flags (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clause_id UUID REFERENCES clauses(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            risk_level TEXT NOT NULL,
            confidence FLOAT NOT NULL,
            reasoning TEXT NOT NULL,
            plain_language TEXT NOT NULL,
            rag_comparison TEXT NOT NULL,
            rule_flags TEXT[] DEFAULT '{}',
            compared_reference_ids UUID[] DEFAULT '{}',
            section_location TEXT
        );
    """)
    
    print("Database schema successfully set up.")

def generate_embeddings(client, texts):
    """Generates 768-dimension embeddings for a list of texts using Gemini API."""
    try:
        response = client.models.embed_content(
            model="gemini-embedding-001",
            contents=texts
        )
        # Extract vector values
        return [item.values for item in response.embeddings]
    except errors.APIError as e:
        print(f"Gemini API Error generating embeddings: {e}")
        raise e
    except Exception as e:
        print(f"Unexpected error during embedding generation: {e}")
        raise e

def seed_corpus(csv_path, batch_size=10):
    """Reads clauses from CSV, embeds them, and inserts them into Postgres."""
    check_env()
    
    print(f"Initializing Gemini Client...")
    client = genai.Client(api_key=GEMINI_API_KEY)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        setup_database(cursor)
        conn.commit()
        
        # Read CSV data
        clauses = []
        if not os.path.exists(csv_path):
            print(f"Error: CSV file not found at {csv_path}")
            sys.exit(1)
            
        with open(csv_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                clauses.append(row)
                
        total_clauses = len(clauses)
        print(f"Loaded {total_clauses} clauses from CSV. Starting embedding and ingestion...")
        
        inserted_count = 0
        
        # Batch processing to optimize API and DB calls
        for i in range(0, total_clauses, batch_size):
            batch = clauses[i:i + batch_size]
            batch_texts = [row['text'] for row in batch]
            
            print(f"Processing batch {i // batch_size + 1}... (items {i} to {min(i + batch_size, total_clauses)})")
            
            # Generate embeddings for the batch
            embeddings = generate_embeddings(client, batch_texts)
            
            # Bulk insert into Postgres
            insert_query = """
                INSERT INTO reference_clauses (text, category, risk_label, explanation, source, embedding)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            
            for row, embedding in zip(batch, embeddings):
                cursor.execute(insert_query, (
                    row['text'],
                    row['category'],
                    row['risk_label'],
                    row['explanation'],
                    row['source'],
                    embedding
                ))
            
            conn.commit()
            inserted_count += len(batch)
            print(f"Successfully inserted {inserted_count}/{total_clauses} clauses.")
            
        print("Reference corpus seeded successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"Transaction rolled back due to error: {e}")
    finally:
        cursor.close()
        conn.close()

def run_test_query(query_text, limit=3):
    """Runs a test cosine similarity search against the seeded database."""
    check_env()
    
    print(f"Testing similarity search for query: '{query_text}'")
    client = genai.Client(api_key=GEMINI_API_KEY)
    
    try:
        # Embed query text
        response = client.models.embed_content(
            model="gemini-embedding-001",
            contents=query_text
        )
        query_vector = response.embeddings[0].values
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # pgvector cosine distance is <=> operator (closer to 0 is more similar, similarity = 1 - distance)
        # Select top limit matches
        cursor.execute("""
            SELECT id, text, category, risk_label, source, (1 - (embedding <=> %s::vector)) as similarity
            FROM reference_clauses
            ORDER BY embedding <=> %s::vector
            LIMIT %s;
        """, (query_vector, query_vector, limit))
        
        results = cursor.fetchall()
        print(f"\nTop {limit} Matches:")
        print("=" * 80)
        for row in results:
            print(f"ID: {row[0]}")
            print(f"Similarity: {row[5]:.4f}")
            print(f"Category: {row[2]} | Risk Label: {row[3]} | Source: {row[4]}")
            print(f"Text: {row[1]}")
            print("-" * 80)
            
    except Exception as e:
        print(f"Test query failed: {e}")
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed or Query ClarifyLaw Reference Corpus")
    parser.add_argument("--csv", type=str, default="backend/corpus/reference_clauses.csv", help="Path to reference clauses CSV")
    parser.add_argument("--test-query", type=str, help="Run a test vector similarity query against the database")
    parser.add_argument("--batch-size", type=int, default=10, help="Batch size for embedding calls")
    
    args = parser.parse_args()
    
    if args.test_query:
        run_test_query(args.test_query)
    else:
        seed_corpus(args.csv, args.batch_size)
