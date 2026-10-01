from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .places import search
from .routing import NoRouteError, RoutingError
from .serializers import TripRequestSerializer
from .trips import plan_trip


class PlaceSearchView(APIView):
    def get(self, request):
        query = request.query_params.get("q", "").strip()
        return Response(search(query) if len(query) >= 2 else [])


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
