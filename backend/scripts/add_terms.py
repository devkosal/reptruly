# add policies to db
# pmy runscript -v3 scripts.add_terms
from dataclasses import dataclass
from datetime import datetime

from django.conf import settings
from termsandconditions.models import TermsAndConditions


@dataclass
class TermsData:
    name: str
    path_to_txt_file: str
    version: float
    date_active: datetime.date
    # describes what changed from the last version
    change_description: str = ""


TERMS_DIR = settings.APPS_DIR / "static/media/terms"

SLUG_TO_TERMS = {
    "terms-and-conditions": [
        TermsData(
            name="Terms and Conditions",
            path_to_txt_file=TERMS_DIR / "terms_and_conditions/v1.0.md",
            version=1.0,
            date_active=datetime(year=2023, month=9, day=1, hour=0, minute=0, second=0),
        ),
        TermsData(
            name="Terms and Conditions",
            path_to_txt_file=TERMS_DIR / "terms_and_conditions/v1.1.md",
            version=1.1,
            date_active=datetime(year=2023, month=9, day=2, hour=0, minute=0, second=0),
        ),
    ],
    "privacy-policy": [
        TermsData(
            name="Privacy Policy",
            path_to_txt_file=TERMS_DIR / "privacy_policy/v1.1.md",
            version=1.0,
            date_active=datetime(year=2023, month=9, day=1, hour=0, minute=0, second=0),
        ),
        TermsData(
            name="Privacy Policy",
            path_to_txt_file=TERMS_DIR / "privacy_policy/v1.1.md",
            version=1.1,
            date_active=datetime(year=2023, month=9, day=2, hour=0, minute=0, second=0),
        ),
    ],
}


def add_terms(
    slug: str,
    name: str,
    version: float,
    text: str,
    info: str,
    date_active: datetime.date,
) -> None:
    existing_terms = TermsAndConditions.objects.filter(
        slug=slug, version_number=version
    )

    if existing_terms.exists():
        print(
            f"terms {slug=} {version=} already exists. it will cause data loss but you can "
            "manually delete existing policies in admin to add it again here"
        )
        return

    terms = TermsAndConditions(
        slug=slug,
        name=name,
        version_number=version,
        text=text,
        info=info,
        date_active=date_active,
    )
    terms.save()


def main(*args, **kwargs):
    for slug, terms_dataset in SLUG_TO_TERMS.items():
        for terms_data in terms_dataset:
            with open(terms_data.path_to_txt_file) as f:
                text = f.read()
            add_terms(
                slug=slug,
                name=terms_data.name,
                version=terms_data.version,
                text=text,
                info=terms_data.change_description,
                date_active=terms_data.date_active,
            )
            print(
                f"finished processing terms creation for {slug=} {terms_data.version=}"
            )


def run(*args, **kwargs) -> None:
    main(*args, **kwargs)
