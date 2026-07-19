import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
        ("djstripe", "0002_2_10"),
        ("ninja_apikey", "0002_alter_apikey_hashed_key"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="customer",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="djstripe.customer",
            ),
        ),
        migrations.CreateModel(
            name="APIKeyProfile",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        verbose_name="UUID",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="Created At"),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="Updated At"),
                ),
                (
                    "name",
                    models.CharField(blank=True, max_length=255, verbose_name="Name"),
                ),
                (
                    "api_key",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile",
                        to="ninja_apikey.apikey",
                    ),
                ),
            ],
            options={
                "abstract": False,
            },
        ),
    ]
