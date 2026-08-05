MOCK_DEMOS = [
  {
    "id": "acme-tos",
    "status": "done",
    "filename": "Acme Cloud Services Terms of Service",
    "documentType": "tos",
    "uploadDate": "Aug 5, 2026",
    "healthScore": 68,
    "summary": "A standard cloud service provider agreement. Contains common intellectual property clauses but contains highly restrictive dispute resolution waivers and long automatic renewal cancellation terms.",
    "clauses": [
      {
        "id": "acme-c1",
        "title": "Class Action Lawsuit Waiver",
        "category": "arbitration_dispute_resolution",
        "riskLevel": "risky",
        "confidence": 0.95,
        "originalText": "TO THE FULLEST EXTENT PERMITTED BY LAW, YOU AGREE THAT ANY DISPUTE RESOLUTION PROCEEDINGS WILL BE CONDUCTED ONLY ON AN INDIVIDUAL BASIS AND NOT IN A CLASS, CONSOLIDATED OR REPRESENTATIVE ACTION, AND YOU EXPRESSLY WAIVE YOUR RIGHT TO PARTICIPATE IN ANY CLASS ACTION LAWSUIT.",
        "simplifiedText": "You give up your right to join other customers in a class-action lawsuit against Acme. If you have a dispute, you must arbitrate it completely on your own.",
        "explanation": "Class action waivers severely limit your leverage as a consumer. Resolving disputes individually is incredibly costly, making it practically impossible to pursue smaller billing claims.",
        "ragComparison": "Standard fair terms either do not strip class-action rights, or they provide an explicit 30-day window from account creation to opt out of the waiver via email.",
        "comparedReferenceIds": [],
        "sectionLocation": "Dispute Resolution",
        "ruleFlags": ["forced_arbitration"]
      },
      {
        "id": "acme-c2",
        "title": "Auto-Renewal & 30-Day Cancellation Window",
        "category": "auto_renewal",
        "riskLevel": "cautionary",
        "confidence": 0.88,
        "originalText": "YOUR SUBSCRIPTION WILL AUTOMATICALLY RENEW AT THE END OF EACH BILLING CYCLE UNLESS YOU PROVIDE WRITTEN NOTICE OF CANCELLATION AT LEAST THIRTY (30) DAYS PRIOR TO THE COMMENCEMENT OF THE NEXT RENEWAL TERM.",
        "simplifiedText": "Your subscription automatically renews. You have to tell Acme you want to cancel at least 30 days before it renews, otherwise you will be charged for the next period.",
        "explanation": "A 30-day cancellation lead time is unusually long for standard SaaS products. Most users assume they can cancel until a few days before renewal, leading to unexpected charges.",
        "ragComparison": "The industry baseline for SaaS subscriptions allows users to cancel at any time prior to the billing date, with service remaining active until the end of the current period.",
        "comparedReferenceIds": [],
        "sectionLocation": "Billing & Term",
        "ruleFlags": ["auto_renewal"]
      },
      {
        "id": "acme-c3",
        "title": "Unilateral Modifications Without Notice",
        "category": "unilateral_modification",
        "riskLevel": "cautionary",
        "confidence": 0.90,
        "originalText": "WE RESERVE THE RIGHT TO MODIFY OR REPLACE THESE TERMS AT ANY TIME AT OUR SOLE DISCRETION. YOUR CONTINUED USE OF THE PLATFORM CONSTITUTES BINDING ACCEPTANCE OF THE AMENDED TERMS.",
        "simplifiedText": "Acme can change any rule in this agreement at any time. Simply continuing to use their website means you agree to whatever new rules they write.",
        "explanation": "This gives the provider the power to change pricing, data permissions, or liability terms without your active consent or notification.",
        "ragComparison": "Fair-play standards require the company to give at least 30 days advance notice via email or banner notification for material changes, allowing the user to terminate their account if they disagree.",
        "comparedReferenceIds": [],
        "sectionLocation": "Agreement changes",
        "ruleFlags": ["unilateral_modification"]
      },
      {
        "id": "acme-c4",
        "title": "User Content Ownership",
        "category": "liability_limitation",
        "riskLevel": "standard",
        "confidence": 0.95,
        "originalText": "YOU RETAIN ALL OWNERSHIP, COPYRIGHT, AND INTELLECTUAL PROPERTY RIGHTS IN THE TEXT, DATA, IMAGES, OR CONTENT THAT YOU SUBMIT, POST, OR UPLOAD TO THE PLATFORM.",
        "simplifiedText": "You own all of your files, images, and content. Acme does not claim any ownership over your uploaded data.",
        "explanation": "This is a customer-friendly clause that ensures you keep full rights to your intellectual property.",
        "ragComparison": "Matches standard user-friendly intellectual property protections.",
        "comparedReferenceIds": [],
        "sectionLocation": "Intellectual Property",
        "ruleFlags": []
      }
    ],
    "topRisks": [
      {
        "id": "acme-c1",
        "title": "Class Action Lawsuit Waiver",
        "category": "arbitration_dispute_resolution",
        "riskLevel": "risky",
        "confidence": 0.95,
        "originalText": "TO THE FULLEST EXTENT PERMITTED BY LAW, YOU AGREE THAT ANY DISPUTE RESOLUTION PROCEEDINGS WILL BE CONDUCTED ONLY ON AN INDIVIDUAL BASIS AND NOT IN A CLASS, CONSOLIDATED OR REPRESENTATIVE ACTION, AND YOU EXPRESSLY WAIVE YOUR RIGHT TO PARTICIPATE IN ANY CLASS ACTION LAWSUIT.",
        "simplifiedText": "You give up your right to join other customers in a class-action lawsuit against Acme. If you have a dispute, you must arbitrate it completely on your own.",
        "explanation": "Class action waivers severely limit your leverage as a consumer. Resolving disputes individually is incredibly costly, making it practically impossible to pursue smaller billing claims.",
        "ragComparison": "Standard fair terms either do not strip class-action rights, or they provide an explicit 30-day window from account creation to opt out of the waiver via email.",
        "comparedReferenceIds": [],
        "sectionLocation": "Dispute Resolution",
        "ruleFlags": ["forced_arbitration"]
      }
    ],
    "categoryBreakdown": {
      "arbitration_dispute_resolution": 1,
      "auto_renewal": 1,
      "unilateral_modification": 1,
      "liability_limitation": 1
    },
    "processingTimeSeconds": 0.05,
    "disclaimer": "This analysis is for informational purposes only and does not constitute legal advice."
  },
  {
    "id": "cozy-haven-lease",
    "status": "done",
    "filename": "Cozy Haven Residential Lease Agreement",
    "documentType": "lease",
    "uploadDate": "Aug 4, 2026",
    "healthScore": 42,
    "summary": "A residential lease agreement for tenant rental. This document contains several illegal or highly unfavorable clauses regarding tenant privacy, security deposits, and maintenance liabilities.",
    "clauses": [
      {
        "id": "lease-c1",
        "title": "Unannounced Landlord Entry",
        "category": "termination_conditions",
        "riskLevel": "risky",
        "confidence": 0.96,
        "originalText": "THE LANDLORD OR AGENTS THEREOF RESERVE THE RIGHT TO ENTER THE PREMISES AT ANY HOUR OF THE DAY OR NIGHT, WITH OR WITHOUT ADVANCED NOTIFICATION TO THE TENANT, TO INSPECT, MAKE REPAIRS, ALTERATIONS, OR SHOW THE PREMISES TO PROSPECTIVE BUYERS.",
        "simplifiedText": "The landlord can enter your apartment at any time of day or night, without giving you any notice beforehand.",
        "explanation": "This directly violates the covenant of quiet enjoyment. In almost all states/countries, landlords are legally required to give 24-48 hours notice before entering, except in real emergencies.",
        "ragComparison": "Standard lease agreements require a minimum of 24 hours written notice and restrict entry to normal business hours (e.g., 9 AM to 6 PM) except during emergencies like fire or flooding.",
        "comparedReferenceIds": [],
        "sectionLocation": "Landlord Access",
        "ruleFlags": ["landlord_unannounced_entry"]
      },
      {
        "id": "lease-c2",
        "title": "Automatic Security Deposit Deduction",
        "category": "fee_structures_penalties",
        "riskLevel": "risky",
        "confidence": 0.92,
        "originalText": "A MANDATORY FLAT FEE OF THREE HUNDRED AND FIFTY DOLLARS ($350) FOR PROFESSIONAL STEAM CLEANING SHALL BE AUTOMATICALLY DEDUCTED FROM THE TENANT SECURITY DEPOSIT UPON LEASE TERMINATION, REGARDLESS OF THE CONDITION OF THE PREMISES.",
        "simplifiedText": "The landlord will automatically take $350 out of your security deposit when you move out to clean the carpets, even if the apartment is completely clean.",
        "explanation": "Security deposits are legally meant to cover damages exceeding normal wear and tear. Auto-deducting standard cleaning fees regardless of cleanliness is prohibited in many renter protection laws.",
        "ragComparison": "Standard rental contracts state that the security deposit is fully refundable and deductions can only be made for actual damage or excessive dirt, supported by an itemized list and receipts.",
        "comparedReferenceIds": [],
        "sectionLocation": "Fees & Deposits",
        "ruleFlags": ["excessive_penalties"]
      },
      {
        "id": "lease-c3",
        "title": "Roommate Liability (Joint & Several)",
        "category": "liability_limitation",
        "riskLevel": "cautionary",
        "confidence": 0.85,
        "originalText": "ALL CO-SIGNERS AND TENANTS UNDER THIS AGREEMENT ARE JOINTLY AND SEVERALLY LIABLE FOR ALL RENTAL PAYMENTS, FEE OBLIGATIONS, AND PHYSICAL DAMAGE REPAIR COSTS INCURRED THROUGHOUT THE LEASE DURATION.",
        "simplifiedText": "If your roommate leaves or fails to pay rent, you are 100% legally responsible for paying their rent and any damages they caused.",
        "explanation": "Joint and several liability is standard in leases, but it is important to be aware of. It protects the landlord, meaning they can pursue you for 100% of the rent even if you already paid your portion.",
        "ragComparison": "This is standard lease practice, but premium leases often allow individual liability shares in student housing or specialized co-living arrangements.",
        "comparedReferenceIds": [],
        "sectionLocation": "Rent & Liability",
        "ruleFlags": []
      },
      {
        "id": "lease-c4",
        "title": "Standard Pet Policy",
        "category": "termination_conditions",
        "riskLevel": "standard",
        "confidence": 0.90,
        "originalText": "NO PETS OR ANIMALS SHALL BE KEPT IN OR ABOUT THE PREMISES WITHOUT THE PRIOR WRITTEN CONSENT OF THE LANDLORD, WHICH CONSENT SHALL NOT BE UNREASONABLY REFUSED OR DELAYED.",
        "simplifiedText": "You need written permission from the landlord before bringing a pet, but they cannot say no without a logical reason.",
        "explanation": "A very standard, balanced pet policy that prevents arbitrary landlord denials while keeping property rules clear.",
        "ragComparison": "Matches common standard lease pet clause recommendations.",
        "comparedReferenceIds": [],
        "sectionLocation": "Property Rules",
        "ruleFlags": []
      }
    ],
    "topRisks": [
      {
        "id": "lease-c1",
        "title": "Unannounced Landlord Entry",
        "category": "termination_conditions",
        "riskLevel": "risky",
        "confidence": 0.96,
        "originalText": "THE LANDLORD OR AGENTS THEREOF RESERVE THE RIGHT TO ENTER THE PREMISES AT ANY HOUR OF THE DAY OR NIGHT, WITH OR WITHOUT ADVANCED NOTIFICATION TO THE TENANT, TO INSPECT, MAKE REPAIRS, ALTERATIONS, OR SHOW THE PREMISES TO PROSPECTIVE BUYERS.",
        "simplifiedText": "The landlord can enter your apartment at any time of day or night, without giving you any notice beforehand.",
        "explanation": "This directly violates the covenant of quiet enjoyment. In almost all states/countries, landlords are legally required to give 24-48 hours notice before entering, except in real emergencies.",
        "ragComparison": "Standard lease agreements require a minimum of 24 hours written notice and restrict entry to normal business hours (e.g., 9 AM to 6 PM) except during emergencies like fire or flooding.",
        "comparedReferenceIds": [],
        "sectionLocation": "Landlord Access",
        "ruleFlags": ["landlord_unannounced_entry"]
      }
    ],
    "categoryBreakdown": {
      "termination_conditions": 2,
      "fee_structures_penalties": 1,
      "liability_limitation": 1
    },
    "processingTimeSeconds": 0.05,
    "disclaimer": "This analysis is for informational purposes only and does not constitute legal advice."
  }
]
