# add cookies to db
# pmy runscript -v3 scripts.add_cookies
# if you need to add google analytics cookies, see these examples
# https://github.com/jazzband/django-cookie-consent/blob/master/testapp/templates/test_page.html
# https://dev.to/pymeister/django-cookie-consent-aj9

from cookie_consent.models import Cookie, CookieGroup

FORCE_ADD = False
COOKIE_GROUPS = {
    "required": {
        "name": "Required",
        "description": "These cookies are required for this website.",
        "is_required": False,  # if true, the message to accept cookies does not appear
        "is_deletable": True,
        "cookies": {
            "sessionid": {
                "description": "In computer science, a session identifier, session ID or session token is "
                "a piece of data that is used in network communications (often over HTTPS) "
                "to identify a session, a series of related message exchanges. Session "
                "identifiers become necessary in cases where the communications infrastructure "
                "uses a stateless protocol such as HTTP. For example, a buyer who visits a "
                "seller's website wants to collect a number of articles in a virtual shopping "
                "cart and then finalize the shopping by going to the site's checkout page. "
                "This typically involves an ongoing communication where several webpages are "
                "requested by the client and sent back to them by the server. In such a situation, "
                "it is vital to keep track of the current state of the shopper's cart, and a session "
                "ID is one way to achieve that goal.",
                "path": "/",
                "domain": "",  # not sure what the purpose of this is
            },
            "csrftoken": {
                "description": "Cross-site request forgery, also known as one-click attack or session riding and "
                "abbreviated as CSRF (sometimes pronounced sea-surf[1]) or XSRF, is a type of "
                "malicious exploit of a website or web application where unauthorized commands "
                "are submitted from a user that the web application trusts.[2] There are many "
                "ways in which a malicious website can transmit such commands; specially-crafted "
                "image tags, hidden forms, and JavaScript fetch or XMLHttpRequests, for example, "
                "can all work without the user's interaction or even knowledge. Unlike cross-site "
                "scripting (XSS), which exploits the trust a user has for a particular site, CSRF "
                "exploits the trust that a site has in a user's browser.[3] In a CSRF attack, an "
                "innocent end user is tricked by an attacker into submitting a web request that "
                "they did not intend. This may cause actions to be performed on the website that "
                "can include inadvertent client or server data leakage, change of session state, "
                "or manipulation of an end user's account.",
                "path": "/",
                "domain": "",  # not sure what the purpose of this is
            },
        },
    }
}


def add_cookie(name: str, cookie_group: CookieGroup, fields: dict[str, str]) -> None:
    existing_cookie = Cookie.objects.filter(name=name)
    if existing_cookie.exists():
        if not FORCE_ADD:
            print("skipping. set `FORCE_ADD` as true to override any existing cookies")
            return
        existing_cookie.delete()
    print(f"creating new cookie for {name=}")
    cookie = Cookie(name=name, cookiegroup=cookie_group, **fields)
    cookie.save()


def add_cookie_group(name: str, fields: dict[str, str | bool]) -> None:
    existing_cookie_group = CookieGroup.objects.filter(varname=name)
    cookies = fields.pop("cookies")
    cookie_group = None
    if existing_cookie_group.exists():
        if FORCE_ADD:
            print("removing existing cookie group")
            existing_cookie_group.delete()
        else:
            print("using existing cookie group")
            cookie_group = existing_cookie_group.first()
    if cookie_group is None:
        print(f"creating new cookie group for {name=}")
        cookie_group = CookieGroup(varname=name, **fields)
        cookie_group.save()
    for name, fields in cookies.items():
        add_cookie(name, cookie_group, fields)


def main(*args, **kwargs):
    print(f"{FORCE_ADD=}. if True, any existing similarly named objs will be deleted.")
    for name, fields in COOKIE_GROUPS.items():
        add_cookie_group(name, fields)
        print(f"finished processing cookie group and cookies creation for {name=}")


def run(*args, **kwargs):
    main(*args, **kwargs)
