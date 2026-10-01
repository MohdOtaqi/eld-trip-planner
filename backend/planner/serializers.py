from rest_framework import serializers


class PlaceSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=200)
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)


class TripRequestSerializer(serializers.Serializer):
    current = PlaceSerializer()
    pickup = PlaceSerializer()
    dropoff = PlaceSerializer()
    cycle_used = serializers.FloatField(min_value=0, max_value=70)
    departure = serializers.DateTimeField(required=False)
