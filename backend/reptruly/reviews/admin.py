from django.contrib import admin

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ["channex_id", "property_name", "ota_name", "overall_score", "has_reply", "reviewed_at"]
    list_filter = ["ota_name", "has_reply", "is_pending"]
    search_fields = ["property_name", "content", "reservation_id", "channex_id"]
    readonly_fields = ["channex_id", "property_id", "raw_data", "created_at", "updated_at"]
