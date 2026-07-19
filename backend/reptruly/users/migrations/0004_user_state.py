from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_user_address_user_city_user_company_name_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="state",
            field=models.CharField(
                blank=True, max_length=128, verbose_name="State / Province"
            ),
        ),
    ]
