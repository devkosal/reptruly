import re
import logging

from django.contrib.sites.requests import RequestSite


def get_logger(debug_level=logging.INFO) -> logging.Logger:
    logging.basicConfig()
    logging.root.setLevel(debug_level)
    logger = logging.getLogger(__name__)
    return logger


def get_domain_from_request(request) -> str:
    """gets the current site's domain given a request.
    taken from `from django.contrib.sites.shortcuts import get_current_site`

    Args:
        request (???):

    Returns:
        str: domain name
    """
    return RequestSite(request).domain


def get_domain_from_url(url: str) -> str:
    url = re.sub(r"https:\/\/", "", url)
    return url.split("/")[0]
