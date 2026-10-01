from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .places import search_addresses, search_cities
from .routing import NoRouteError, RoutingError
from .serializers import TripRequestSerializer
from .trips import plan_trip


class PlaceSearchView(APIView):
    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            return Response([])
        if "addresses" in request.query_params:
            return Response(search_addresses(query))
        return Response(search_cities(query))


class PlanTripView(APIView):
    def post(self, request):
        serializer = TripRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            return Response(plan_trip(**serializer.validated_data))
        except NoRouteError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        except RoutingError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
