CAC.Map.Control = (function ($, Handlebars, L, _) {
    'use strict';

    var defaults = {
        id: 'map',
        center: [39.95, -75.1667],
        zoom: 14,
        selectors: {
            destinationPopup: '.destination-directions-link'
        }
    };
    var maxZoom = 18;

    var map = null;
    var userMarker = null;
    var geocodeMarker = null;
    var originMarker = null;
    var destinationMarker = null;

    var overlaysControl = null;
    var itineraries = {};

    var events = $({});
    var eventNames = {
        destinationPopupClick: 'cac:map:control:destinationpopup',
        currentLocationClick: 'cac:map:control:currentlocation',
    };
    var basemaps = {};
    var overlays = {};
    var destinationsLayer = null;
    var destinationMarkers = {};
    var lastHighlightedMarker = null;
    var isochroneLayer = null;
    var tabControl = null;

    var destinationIcon = L.AwesomeMarkers.icon({
        icon: 'plane',
        prefix: 'fa',
        markerColor: 'blue'
    });
    var highlightIcon = L.AwesomeMarkers.icon({
        icon: 'plane',
        prefix: 'fa',
        iconColor: 'black',
        markerColor: 'lightblue'
    });

    var esriSatelliteAttribution = [
        '&copy; <a href="http://www.esri.com/">Esri</a> ',
        'Source: Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, ',
        'AEX, Getmapping, Aerogrid, IGN, IGP, swisstopo, and the GIS User Community'
    ].join('');
    var stamenTonerAttribution = [
        'Map tiles by <a href="http://stamen.com">Stamen Design</a>, ',
        'under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ',
        'Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, ',
        'under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
    ].join('');
    var stamenAttribution = [
        'Map tiles by <a href="http://stamen.com">Stamen Design</a>, ',
        'under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ',
        'Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, ',
        'under <a href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.'
    ].join('');

    function MapControl(options) {
        this.events = events;
        this.options = $.extend({}, defaults, options);
        overlaysControl = new CAC.Map.OverlaysControl();
        map = L.map(this.options.id, { zoomControl: false })
            .setView(this.options.center, this.options.zoom);

        // put zoom control on top right
        new L.Control.Zoom({ position: 'topright' }).addTo(map);

        tabControl = options.tabControl;

        initializeBasemaps();
        initializeOverlays();
        initializeLayerControl();

        // set listener for click event on destination popup
        $('#' + this.options.id).on('click', this.options.selectors.destinationPopup, function(event) {
            events.trigger(eventNames.destinationPopupClick,
                           destinationMarkers[event.currentTarget.id].destination);
        });
    }

    MapControl.prototype.clearIsochrone = clearIsochrone;
    MapControl.prototype.clearDiscoverPlaces = clearDiscoverPlaces;
    MapControl.prototype.fetchIsochrone = fetchIsochrone;
    MapControl.prototype.setBounds = setBounds;
    MapControl.prototype.locateUser = locateUser;
    MapControl.prototype.drawDestinations = drawDestinations;
    MapControl.prototype.plotItinerary = plotItinerary;
    MapControl.prototype.clearItineraries = clearItineraries;
    MapControl.prototype.setGeocodeMarker = setGeocodeMarker;
    MapControl.prototype.setOriginDestinationMarkers = setOriginDestinationMarkers;
    MapControl.prototype.highlightDestination = highlightDestination;

    return MapControl;

    function initializeBasemaps() {
        basemaps.Terrain = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png', {
            attribution: stamenAttribution
        });

        basemaps.Satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: esriSatelliteAttribution
        });

        basemaps.Streets = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png', {
            attribution: stamenTonerAttribution
        });

        basemaps.Terrain.addTo(map);
    }

    function initializeOverlays() {
        overlays['Bike Share Locations'] = overlaysControl.bikeShareOverlay();
        overlays['Bike Parking'] = overlaysControl.bikeParkingOverlay();
        overlays['Nearby Events'] = overlaysControl.nearbyEventsOverlay();
        overlays['Nearby Events'].addTo(map);
    }

    function initializeLayerControl() {
        L.control.layers(basemaps, overlays, {
            position: 'bottomright',
            collapsed: false
        }).addTo(map);
    }

    /**
     * Use HTML5 navigator to locate user and place a circle at their estimated location.
     *
     * @return {object} (promise) which should resolve to the current coordinates of a user
     */
    function locateUser() {
        var deferred = $.Deferred();
        var options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        };
        var success = function(pos) {
            var latlng = [pos.coords.latitude, pos.coords.longitude];
            if (userMarker) {
                userMarker.setLatLng(latlng);
            } else {
                userMarker = new L.CircleMarker(latlng)
                  .on('click', function() {
                      // TODO: not implemented
                      events.trigger(eventNames.currentLocationClick, latlng);
                  });
                userMarker.setRadius(5);
                map.addLayer(userMarker);
            }
            deferred.resolve(latlng);
        };
        var failure = function(error) {
            deferred.fail(function(){return 'ERROR(' + error.code + '): ' + error.message; });
        };

        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(success, failure, options);
        } else {
            deferred.fail(function() { return 'geolocation not supported on this device'; });
        }
        return deferred.promise();
    }

    /**
     * Add isochrone outline to map
     */
    function drawIsochrone(isochrone) {
        isochroneLayer = L.geoJson(isochrone, {
            clickable: false,
            style: {
                'color': 'red',
                'opacity': 0.8
            }
        }).addTo(map);
    }

    /**
     * Fetch all the reachable destinations within our destination database,
     * and their enclosing isochrone (travelshed).
     *
     * @return {Object} Promise resolving to JSON with 'matched' and 'isochrone' properties
     */
    function fetchReachable(payload) {
        var isochroneUrl = '/map/reachable';
        var deferred = $.Deferred();
        $.ajax({
            type: 'GET',
            data: payload,
            cache: false,
            url: isochroneUrl,
            contentType: 'application/json'
        }).then(deferred.resolve);
        return deferred.promise();
    }

    /**
     * Get travelshed and destinations within it, then display results on map.
    */
    function fetchIsochrone(coordsOrigin, when, exploreMinutes, otpParams) {
        var deferred = $.Deferred();
        // clear results of last search
        clearDiscoverPlaces();

        var getIsochrone = function(params) {
            fetchReachable(params).then(function(data) {
                if (!tabControl.isTabShowing('explore')) {
                    // if user has switched away from the explore tab, do not show results
                    deferred.resolve();
                    return;
                }
                drawIsochrone(data.isochrone);
                // also draw 'matched' list of locations
                drawDestinations(data.matched);
                deferred.resolve(data.matched);
            }, function(error) {
                console.error(error);
            });
        };

        var formattedTime = when.format('hh:mma');
        var formattedDate = when.format('YYYY/MM/DD');

        var params = {
            time: formattedTime,
            date: formattedDate,
            cutoffSec: exploreMinutes * 60, // API expects seconds
        };

        params = $.extend(otpParams, params);

        if (coordsOrigin) {
            params.fromPlace = coordsOrigin.join(',');
            getIsochrone(params);
        } else {
            locateUser().then(function(data) {
                params.fromPlace = data.join(',');
                getIsochrone(params);
            }, function(error) {
                console.error('Could not geolocate user');
                console.error(error);
                // use default location
                getIsochrone(params);
            });
        }

        return deferred.promise();
    }

    /**
     * Draw an array of geojson destination points onto the map
     */
    function drawDestinations(matched) {
        // put destination details onto point geojson object's properties
        // build map of unconverted destination objects
        var destinations = {};
        var locationGeoJSON = _.map(matched, function(destination) {
            destinations[destination.id] = destination;
            var point = _.property('point')(destination);
            point.properties = _.omit(destination, 'point');
            return point;
        });
        destinationMarkers = {};
        destinationsLayer = L.geoJson(locationGeoJSON, {
            onEachFeature: function(feature, layer) {
                layer.on('click', function(){
                    // TODO: this triggers on marker click, not popup
                });
            },
            pointToLayer: function (geojson, latLng) {
                var popupOptions = { maxWidth: 300 };
                var popupTemplate = ['<p><b>{{geojson.properties.name}}</b></p>',
                                     '<p>{{geojson.properties.description}}',
                                     '</p><a href="{{geojson.properties.website_url}}" ',
                                     'target="_blank">{{geojson.properties.website_url}}</a>',
                                     '<a href="#" class="destination-directions-link pull-right" ',
                                     'id="{{geojson.properties.id}}">Get Directions</a>'
                                    ].join('');
                var template = Handlebars.compile(popupTemplate);
                var popupContent = template({geojson: geojson});
                var markerId = geojson.properties.id;
                var marker = new L.marker(latLng, {icon: destinationIcon})
                        .bindPopup(popupContent, popupOptions);
                destinationMarkers[markerId] = {
                    marker: marker,
                    destination: destinations[geojson.properties.id]
                };
                return marker;
            }
        }).addTo(map);
    }

    /**
     * Set the map bounds, optionally setting options
     * @param {[L.LatLngBounds]} bounds
     * @param {[L.fitBoundsOptions]} options
     */
    function setBounds(bounds, options) {
        var defaults = {
            // TODO: Figure out why allowing animation causes the map to get all weird
            // test case: 450 market st -> 200 chestnut st
            animate: false,
            maxZoom: maxZoom,
            // So that origin/dest don't show under the sidebar
            paddingTopLeft: [400, 0]
        };
        map.fitBounds(bounds, $.extend({}, defaults, options));
    }

    /**
     * Plots an itinerary on a map
     *
     * @param {object} map Leaflet map object
     * @param {integer} id id of itinerary to highlight
     */
    function plotItinerary(itinerary) {
        itineraries[itinerary.id] = itinerary;
        itinerary.geojson.addTo(map);
    }


    function clearItineraries() {
        _.forIn(itineraries, function (itinerary) {
            map.removeLayer(itinerary.geojson);
        });
        itineraries = {};
    }

    /**
     * Remove layers for isochrone and destinations within it.
     */
    function clearDiscoverPlaces() {
        clearDestinations();
        clearIsochrone();
    }

    function clearDestinations() {
        if (destinationsLayer) {
            map.removeLayer(destinationsLayer);
        }
    }

    function clearIsochrone() {
        if (isochroneLayer) {
            map.removeLayer(isochroneLayer);
        }
    }

    function setGeocodeMarker(latLng) {
        if (latLng === null) {
            if (geocodeMarker) {
                map.removeLayer(geocodeMarker);
            }
            geocodeMarker = null;
            return;
        }
        if (geocodeMarker) {
            geocodeMarker.setLatLng(latLng);
        } else {
            var icon = L.AwesomeMarkers.icon({
                icon: 'dot-circle-o',
                prefix: 'fa',
                markerColor: 'darkred'
            });
            geocodeMarker = new L.marker(latLng, { icon: icon });
            geocodeMarker.addTo(map);
        }
        map.panTo(latLng);
    }

    /**
     * Show markers for trip origin/destination.
     * Will unset the markers if either coordinate set is null/empty.
     *
     * @param {Array} originCoords Start point coordinates [lat, lng]
     * @param {Array} destinationCoords End point coordinates [lat, lng]
     */
    function setOriginDestinationMarkers(originCoords, destinationCoords) {

        if (!originCoords || !destinationCoords) {

            if (originMarker) {
                map.removeLayer(originMarker);
            }

            if (destinationMarker) {
                map.removeLayer(destinationMarker);
            }

            originMarker = null;
            destinationMarker = null;
            return;
        }

        var origin = L.latLng(originCoords[0], originCoords[1]);
        var destination = L.latLng(destinationCoords[0], destinationCoords[1]);

        if (originMarker && destinationMarker) {
            originMarker.setLatLng(origin);
            destinationMarker.setLatLng(destination);
        } else {
            var originIcon = L.AwesomeMarkers.icon({
                icon: 'home',
                prefix: 'fa',
                markerColor: 'green'
            });

            var destIcon = L.AwesomeMarkers.icon({
                icon: 'flag-o',
                prefix: 'fa',
                markerColor: 'red'
            });

            originMarker = new L.marker(origin, {icon: originIcon }).bindPopup('<p>Origin</p>');
            destinationMarker = new L.marker(destination, {icon: destIcon })
                                            .bindPopup('<p>Destination</p>');
            originMarker.addTo(map);
            destinationMarker.addTo(map);
        }
        map.panTo(origin);
    }

    function highlightDestination(destinationId, opts) {
        var defaults = {
            panTo: false
        };
        var options = $.extend({}, defaults, opts);
        if (!destinationId) {
            // revert to original marker if set
            if (lastHighlightedMarker) {
                lastHighlightedMarker.setIcon(destinationIcon);
            }
            return;
        }
        // Update icon for passed destination
        var marker = destinationMarkers[destinationId].marker;
        marker.setIcon(highlightIcon);
        if (options.panTo) {
            map.panTo(marker.getLatLng());
        }
        lastHighlightedMarker = marker;
    }

})(jQuery, Handlebars, L, _);
