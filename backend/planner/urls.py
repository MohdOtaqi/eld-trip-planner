from django.urls import path

from .views import PlaceSearchView, PlanTripView

urlpatterns = [
    path("places", PlaceSearchView.as_view()),
    path("trips/plan", PlanTripView.as_view()),
]
