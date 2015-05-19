/**
 *  View control for the sidebar directions tab
 *
 */
CAC.Control.SidebarDirections = (function ($, Control, BikeModeOptions, Geocoder,
                                 Routing, Typeahead, UserPreferences, Utils) {

    'use strict';

    var METERS_PER_MILE = 1609.34;

    // Number of millis to wait on input changes before sending directions request
    var DIRECTION_THROTTLE_MILLIS = 750;

    // default maxWalk when biking (in miles)
    var MAXWALK_BIKE = 300;

    var defaults = {
        selectors: {
            bikeTriangleDiv: '#directionsBikeTriangle',
            buttonPlanTrip: 'section.directions button[type=submit]',
            datepicker: '#datetimeDirections',
            departAtSelect: '#directionsDepartAt',
            destination: 'section.directions input.destination',
            directions: '.directions',
            directionInput: '.direction-input',
            errorClass: 'error',
            itineraryBlock: '.block-itinerary',
            itineraryList: 'section.directions .itineraries',
            maxWalkDiv: '#directionsMaxWalk',
            modeSelectors: '#directionsModes input',
            origin: 'section.directions input.origin',
            resultsClass: 'show-results',
            spinner: 'section.directions div.sidebar-details > .sk-spinner',
            typeahead: 'section.directions input.typeahead',
            wheelchairDiv: '#directionsWheelchair'
        }
    };
    var options = {};

    var currentItinerary = null;
    var datepicker = null;

    var directions = {
        origin: null,
        destination: null
    };

    var bikeModeOptions = null;
    var mapControl = null;
    var tabControl = null;
    var directionsListControl = null;
    var itineraryListControl = null;
    var typeahead = null;

    var initialLoad = true;

    function SidebarDirectionsControl(params) {
        options = $.extend({}, defaults, params);
        mapControl = options.mapControl;
        tabControl = options.tabControl;
        bikeModeOptions = new BikeModeOptions();

        // Plan a trip using information provided
        $(options.selectors.buttonPlanTrip).click($.proxy(planTrip, this));

        $(options.selectors.modeSelectors).change($.proxy(changeMode, this));

        // initiallize date/time picker
        datepicker = $(options.selectors.datepicker).datetimepicker({useCurrent: true});
        datepicker.on('dp.change', planTrip);

        directionsListControl = new Control.DirectionsList({
            showBackButton: true,
            showShareButton: true,
            selectors: {
                container: 'section.directions .directions-list',
                directionItem: '.direction-item',
                backButton: 'a.back',
                shareButton: 'a.share'
            }
        });
        directionsListControl.events.on(directionsListControl.eventNames.backButtonClicked,
                                        onDirectionsBackClicked);

        itineraryListControl = new Control.ItineraryList({
            selectors: {
                container: 'section.directions .itineraries'
            }
        });
        itineraryListControl.events.on(itineraryListControl.eventNames.itineraryClicked,
                                       onItineraryClicked);
        itineraryListControl.events.on(itineraryListControl.eventNames.itineraryHover,
                                       onItineraryHover);

        typeahead = new Typeahead(options.selectors.typeahead);
        typeahead.events.on(typeahead.eventNames.selected, onTypeaheadSelected);
        typeahead.events.on(typeahead.eventNames.cleared, onTypeaheadCleared);

        // Listen to direction hovered events in order to show a point on the map
        directionsListControl.events.on(
            directionsListControl.eventNames.directionHovered,
            function(e, lon, lat) {
                mapControl.displayPoint(lon, lat);
            });

        setFromUserPreferences();

        // Respond to changes on all direction input fields
        $(options.selectors.directionInput).on('input change', planTrip);
    }

    SidebarDirectionsControl.prototype = {
        clearDirections: clearDirections,
        moveOriginDestination: moveOriginDestination,
        setDestination: setDestination,
        setDirections: setDirections
    };

    /**
     * Set user preferences before planning trip.
     * Throttled to cut down on requests.
     */
    var planTrip = _.throttle(function() {
        if (initialLoad || !tabControl.isTabShowing('directions')) {
            return;
        }

        if (!(directions.origin && directions.destination)) {
            setDirectionsError('origin');
            setDirectionsError('destination');
            return;
        }

        // show spinner while loading
        itineraryListControl.hide();
        directionsListControl.hide();
        $(options.selectors.spinner).removeClass('hidden');

        var picker = $(options.selectors.datepicker).data('DateTimePicker');
        var date = picker.date();
        if (!date) {
            // use current date/time if none set
            date = moment();
        }

        var mode = bikeModeOptions.getMode(options.selectors.modeSelectors);
        var origin = directions.origin;
        var destination = directions.destination;

        var arriveBy = false; // depart at time by default
        if ($(options.selectors.departAtSelect).val() === 'arriveBy') {
            arriveBy = true;
        }

        // options to pass to OTP as-is
        var otpOptions = {
            mode: mode,
            arriveBy: arriveBy
        };

        if (mode.indexOf('BICYCLE') > -1) {
            var bikeTriangleOpt = $('option:selected', options.selectors.bikeTriangleDiv);
            var bikeTriangle = bikeTriangleOpt.val();
            $.extend(otpOptions, {optimize: 'TRIANGLE'},
                     bikeModeOptions.options.bikeTriangle[bikeTriangle]);
            UserPreferences.setPreference('bikeTriangle', bikeTriangle);

            // allow longer bike riding when using public transit
            $.extend(otpOptions, { maxWalkDistance: MAXWALK_BIKE * METERS_PER_MILE });
        } else {
            var maxWalk = $('input', options.selectors.maxWalkDiv).val();
            if (maxWalk) {
                UserPreferences.setPreference('maxWalk', maxWalk);
                $.extend(otpOptions, { maxWalkDistance: maxWalk * METERS_PER_MILE });
            } else {
                UserPreferences.setPreference('maxWalk', undefined);
            }

            // true if box checked
            var wheelchair = $('input', options.selectors.wheelchairDiv).prop('checked');
            UserPreferences.setPreference('wheelchair', wheelchair);
            $.extend(otpOptions, { wheelchair: wheelchair });
        }

        // set user preferences
        UserPreferences.setPreference('method', 'directions');
        UserPreferences.setPreference('mode', mode);
        UserPreferences.setPreference('arriveBy', arriveBy);

        Routing.planTrip(origin, destination, date, otpOptions).then(function (itineraries) {

            $(options.selectors.spinner).addClass('hidden');
            if (!tabControl.isTabShowing('directions')) {
                // if user has switched away from the directions tab, do not show trip
                return;
            }
            // Add the itineraries to the map, highlighting the first one
            var isFirst = true;
            mapControl.clearItineraries();
            _.forIn(itineraries, function (itinerary) {
                mapControl.plotItinerary(itinerary, isFirst);
                itinerary.highlight(isFirst);
                if (isFirst) {
                    currentItinerary = itinerary;
                    isFirst = false;
                }
            });

            // put markers at start and end
            mapControl.setOriginDestinationMarkers(directions.origin, directions.destination);

            // Update map bounds
            mapControl.setBounds(currentItinerary.getBounds(0.1));

            itineraryListControl.setItineraries(itineraries);
            $(options.selectors.directions).addClass(options.selectors.resultsClass);
            itineraryListControl.show();
        }, function (error) {
            $(options.selectors.spinner).addClass('hidden');
            mapControl.clearItineraries();
            itineraryListControl.setItinerariesError(error);
            $(options.selectors.directions).addClass(options.selectors.resultsClass);
            itineraryListControl.show();
        });
    }, DIRECTION_THROTTLE_MILLIS);

    return SidebarDirectionsControl;

    function changeMode() {
        bikeModeOptions.changeMode(options.selectors);
        planTrip();
    }

    function clearDirections() {
        mapControl.setOriginDestinationMarkers(null, null);
        clearItineraries();
    }

    function clearItineraries() {
        mapControl.clearItineraries();
        itineraryListControl.hide();
        directionsListControl.hide();
        $(options.selectors.directions).removeClass(options.selectors.resultsClass);
    }


    function onDirectionsBackClicked() {
        // show the other itineraries again
        itineraryListControl.showItineraries(true);
        currentItinerary.highlight(true);
        directionsListControl.hide();
        itineraryListControl.show();
    }

    /**
     * Handles click events to select a given itinerary
     */
    function onItineraryClicked(event, itinerary) {
        if (itinerary) {
            // hide all other itineraries
            itineraryListControl.showItineraries(false);
            itinerary.show(true);
            itinerary.highlight(true);
            currentItinerary = itinerary;

            directionsListControl.setItinerary(itinerary);

            itineraryListControl.hide();
            directionsListControl.show();
        }
    }

    function findItineraryBlock(id) {
        return $(options.selectors.itineraryBlock + '[data-itinerary="' + id + '"]');
    }

    /**
     * Handles hover events to highlight a given itinerary
     */
    function onItineraryHover(event, itinerary) {
        if (itinerary) {
            findItineraryBlock(currentItinerary.id).css('background-color', 'white');
            findItineraryBlock(itinerary.id).css('background-color', 'lightgray');
            currentItinerary.highlight(false);
            itinerary.highlight(true);
            currentItinerary = itinerary;
        }
    }

    function onTypeaheadCleared(event, key) {
        // delete directions object/label values
        if (key === 'origin' || key === 'destination') {
            clearItineraries();
            directions[key] = null;
            var prefKey = key === 'origin' ? 'from' : 'to';
            UserPreferences.setPreference(prefKey, undefined);
            UserPreferences.setPreference(prefKey + 'Text', undefined);
        }
    }

    function onTypeaheadSelected(event, key, location) {
        if (key === 'origin' || key === 'destination') {
            var prefKey = key === 'origin' ? 'from' : 'to';

            if (!location) {
                UserPreferences.setPreference(prefKey, undefined);
                setDirections(key, null);
                return;
            }

            // save text for address to preferences
            UserPreferences.setPreference(prefKey, location);
            UserPreferences.setPreference(prefKey + 'Text', location.name);
            setDirections(key, [location.feature.geometry.y, location.feature.geometry.x]);

            planTrip();
        }
    }

    /**
     * Change the origin or destination, then requery for directions.
     *
     * @param {String} key Either 'origin' or 'destination'
     * @param {Object} position Has coordinates for new spot as 'lat' and 'lng' properties
     */
    function moveOriginDestination(key, position) {
        if (key === 'origin' || key === 'destination') {
            var prefKey = key === 'origin' ? 'from' : 'to';
        } else {
            console.error('Unrecognized key in moveOriginDestination: ' + key);
            return;
        }

        // show spinner while loading
        itineraryListControl.hide();
        directionsListControl.hide();
        $(options.selectors.spinner).removeClass('hidden');

        Geocoder.reverse(position.lat, position.lng).then(function (data) {
            if (data && data.address) {
                var location = Utils.convertReverseGeocodeToFeature(data);
                UserPreferences.setPreference(prefKey, location);
                /*jshint camelcase: false */
                var fullAddress = data.address.Match_addr;
                /*jshint camelcase: true */
                UserPreferences.setPreference(prefKey + 'Text', fullAddress);
                $(options.selectors[key]).typeahead('val', fullAddress);
                setDirections(key, [position.lat, position.lng]);
                planTrip();
            } else {
                // unset location and show error
                UserPreferences.setPreference(prefKey, undefined);
                UserPreferences.setPreference(prefKey + 'Text', undefined);
                $(options.selectors[key]).typeahead('val', '');
                setDirections(key, null);
                $(options.selectors.spinner).addClass('hidden');
                itineraryListControl.setItinerariesError({
                    msg: 'Could not find street address for location.'
                });
                $(options.selectors.directions).addClass(options.selectors.resultsClass);
                itineraryListControl.show();
            }
        });
    }

    // called when going to show directions from 'explore' origin to a selected feature
    function setDestination(destination) {
        // Set origin
        var origin = UserPreferences.getPreference('origin');
        var originText = UserPreferences.getPreference('originText');
        directions.origin = [origin.feature.geometry.y, origin.feature.geometry.x];

        // Set destination
        var toCoords = destination.point.coordinates;
        var destinationText = destination.address;
        directions.destination = [toCoords[1], toCoords[0]];

        // Save destination coordinates in expected format (to match typeahead results)
        destination.feature = {
            geometry: {
                x: toCoords[0],
                y: toCoords[1]
            }
        };

        // set in UI
        var mode = UserPreferences.getPreference('mode');
        bikeModeOptions.setMode(options.selectors.modeSelectors, mode);
        var bikeTriangle = UserPreferences.getPreference('bikeTriangle');
        $(options.selectors.origin).typeahead('val', originText);
        $(options.selectors.destination).typeahead('val', destinationText);
        $('select', options.selectors.bikeTriangleDiv).val(bikeTriangle);

        // Save selections to user preferences
        UserPreferences.setPreference('from', origin);
        UserPreferences.setPreference('fromText', originText);
        UserPreferences.setPreference('to', destination);
        UserPreferences.setPreference('toText', destinationText);

        // Get directions
        planTrip();
    }

    function setDirections(key, value) {
        clearItineraries();
        if (key === 'origin' || key === 'destination') {
            directions[key] = value;
            setDirectionsError(key);
        } else {
            console.error('Directions key ' + key + 'unrecognized!');
        }
    }

    function setDirectionsError(key) {
        var $input = null;
        if (key === 'origin') {
            $input = $(options.selectors.origin);
        } else {
            $input = $(options.selectors.destination);
        }

        if (directions[key]) {
            $input.removeClass(options.selectors.errorClass);
        } else {
            $input.addClass(options.selectors.errorClass);
        }
    }

    /**
     * When first navigating to this page, check for user preferences to load.
     */
    function setFromUserPreferences() {
        var method = UserPreferences.getPreference('method');
        var mode = UserPreferences.getPreference('mode');
        var arriveBy = UserPreferences.getPreference('arriveBy');
        var bikeTriangle = UserPreferences.getPreference('bikeTriangle');
        var from = UserPreferences.getPreference('from');
        var to = UserPreferences.getPreference('to');
        var fromText = UserPreferences.getPreference('fromText');
        var toText = UserPreferences.getPreference('toText');
        var maxWalk = UserPreferences.getPreference('maxWalk');
        var wheelchair = UserPreferences.getPreference('wheelchair');

        if (wheelchair) {
            $('input', options.selectors.wheelchairDiv).click();
        }

        if (maxWalk) {
            $('input', options.selectors.maxWalkDiv).val(maxWalk);
        }

        bikeModeOptions.setMode(options.selectors.modeSelectors, mode);

        $('select', options.selectors.bikeTriangleDiv).val(bikeTriangle);

        if (arriveBy) {
            $(options.selectors.departAtSelect).val('arriveBy');
         }

        if (to && to.feature && to.feature.geometry) {
            directions.destination = [to.feature.geometry.y, to.feature.geometry.x];
            $(options.selectors.destination).typeahead('val', toText);
        }

        if (from && from.feature && from.feature.geometry) {
            directions.origin = [from.feature.geometry.y, from.feature.geometry.x];
            $(options.selectors.origin).typeahead('val', fromText);
        }

        if (method === 'directions') {
            // switch tabs
            tabControl.setTab('directions');

            if (from && to) {
                planTrip();
            } else {
                clearDirections();
            }
        }

        initialLoad = false;
    }

})(jQuery, CAC.Control, CAC.Control.BikeModeOptions, CAC.Search.Geocoder,
    CAC.Routing.Plans, CAC.Search.Typeahead, CAC.User.Preferences, CAC.Utils);
