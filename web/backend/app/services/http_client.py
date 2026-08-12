"""SSRF-safe HTTP fetching shared by discovery and the pipeline parser.

Both discovery (homepage / sitemap / guess / cross-domain) and
``parser.parse_url`` fetch URLs that ultimately originate from an analyzed
site's HTML. That HTML can link to private/loopback addresses, so every hop --
including redirects -- is resolved and checked against blocked ranges before
connecting. This is especially load-bearing now that cross-domain follows
(Fix 4) fetch external URLs the analyzed site links to.
"""
import ipaddress
import socket
from urllib.parse import urljoin, urlparse

import requests

_BLOCKED_NETWORKS = (
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),   # CGNAT
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),         # IPv6 ULA
    ipaddress.ip_network("fe80::/10"),        # IPv6 link-local
)

_MAX_REDIRECTS = 5


def _is_safe_host(host: str) -> bool:
    if not host:
        return False
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except (ValueError, IndexError):
            continue
        if any(ip in net for net in _BLOCKED_NETWORKS):
            return False
    return True


def safe_get(url: str, headers: dict, timeout: float) -> requests.Response | None:
    """GET ``url`` following redirects manually, SSRF-checking every hop.

    Returns the final non-redirect Response, or None if any hop is unsafe, has
    too many redirects, or the request errors. The caller still owns status-code
    handling (e.g. ``raise_for_status`` or treating >=400 as a miss).
    """
    try:
        host = urlparse(url).hostname
        if not _is_safe_host(host):
            return None
        for _ in range(_MAX_REDIRECTS + 1):
            resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=False)
            if resp.is_redirect:
                loc = resp.headers.get("Location")
                if not loc:
                    return None
                url = urljoin(url, loc)
                host = urlparse(url).hostname
                if not _is_safe_host(host):
                    return None
                continue
            return resp
        return None
    except Exception:
        return None
