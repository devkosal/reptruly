from enum import Enum
from functools import partial

from django.core.serializers.json import DjangoJSONEncoder
from django.db import models

models.TextChoices


DjangoJSONField_partial = partial(models.JSONField, encoder=DjangoJSONEncoder)


def generate_enum_char_field(enum: Enum, max_length: int = 32, *args, **kwargs):
    """
    abstracts creating enum based char field
    choices format example:
    [('TEXT_TO_SPEECH', 'text_to_speech'), ('TABULAR_CLASSIFICATION', 'tabular_classification')]

    Args:
        enum (Enum): enum used to extract choices
        max_length (int): max characters length
    """
    choices = [(v.value, v.value) for v in enum._member_map_.values()]
    if any([len(v) >= max_length for v, _ in choices]):
        raise ValueError(f"choice value is greater than {max_length=} in {choices=}")
    return models.CharField(*args, max_length=max_length, choices=choices, **kwargs)
