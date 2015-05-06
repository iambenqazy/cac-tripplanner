/**
 *  View control for the itinerary list
 *
 */
CAC.Control.ItineraryList = (function (_, $, Handlebars, Utils) {

    'use strict';

    var defaults = {
        // Should the back button be shown in the control
        //  this is weird, ideally we would handle the back button in the wrapper view, but we
        //  need to switch out the sidebar div as a whole
        showBackButton: false,
        // Should the share button be shown in the control
        showShareButton: false,
        selectors: {
            container: '.itineraries'
        }
    };
    var options = {};

    var events = $({});
    var eventNames = {
        itineraryClicked: 'cac:control:itinerarylist:itineraryclicked',
        itineraryHover: 'cac:control:itinerarylist:itineraryhover'
    };

    var $container = null;
    var itineraries = [];

    function ItineraryListControl(params) {
        options = $.extend({}, defaults, params);

        $container = $(options.selectors.container);
    }

    ItineraryListControl.prototype = {
        events: events,
        eventNames: eventNames,
        setItineraries: setItineraries,
        setItinerariesError: setItinerariesError,
        showItineraries: showItineraries,
        show: show,
        hide: hide,
        toggle: toggle
    };

    return ItineraryListControl;

    /**
     * Set the directions list from an OTP itinerary object
     * @param {[object]} itinerary An open trip planner itinerary object, as returned from the plan endpoint
     */
    function setItineraries(newItineraries) {
        // Add unique itineraries.
        // Due to issue: https://github.com/opentripplanner/OpenTripPlanner/issues/1894
        // itineraries with transit + (bike/walk) can return 3 identical itineraries if only
        // bike/walk used, and not transit.
        itineraries = [];
        if (newItineraries.length > 0) {
            // _.findWhere returns null if list is empty, so prime list with first itinerary
            itineraries.push(newItineraries[0]);
        }
        _.each(newItineraries, function(itinerary) {
            if (_.findWhere(itineraries, itinerary) === null) {
                itineraries.push(itinerary);
            }
        });

        // Show the directions div and populate with itineraries
        var html = getTemplate(itineraries);
        $container.html(html);
        $('a.itinerary').on('click', onItineraryClicked);
        $('.block-itinerary').on('click', onItineraryClicked);
        $('a.itinerary').hover(onItineraryHover);
        $('.block-itinerary').hover(onItineraryHover);
    }

    // Template for itinerary summaries
    function getTemplate(itineraries) {
        Handlebars.registerHelper('modeIcon', function(modeString) {
            return new Handlebars.SafeString(Utils.modeStringHelper(modeString));
        });

        var source = '{{#each itineraries}}' +
                '<div class="block block-itinerary" data-itinerary="{{this.id}}">' +
                    '<div class="trip-numbers">' +
                        '<div class="trip-duration"> {{this.formattedDuration}}</div>' +
                        '<div class="trip-distance"> {{this.distanceMiles}} mi</div>' +
                    '</div>' +
                    '<div class="trip-details">' +
                        '{{#each this.modes}}' +
                            '<div class="direction-icon">' +
                                ' {{modeIcon this}}' +
                            '</div>' +
                        '{{/each}}' +
                        '<span class="short-description"> via {{this.via}}</span>' +
                        '<a class="itinerary" data-itinerary="{{this.id}}"> View Directions</a>' +
                    '</div>' +
                '</div>' +
                '{{/each}}';
        var template = Handlebars.compile(source);
        var html = template({itineraries: itineraries});
        return html;
    }

    /**
     * Use in case OTP planner returns an error
     * @param {Object} Error object returned from OTP
     */
    function setItinerariesError(error) {
        var source = '<div class="block block-itinerary">' +
                '<span class="short-description"><b>{{error.msg}}</b></span>' +
                '</div>';
        var template = Handlebars.compile(source);
        var html = template({error: error});
        $container.html(html);
    }

    function getItineraryById(id) {
        return itineraries[id];
    }

    /**
     * Handle click event on itinerary list item, this is set to element clicked
     */
    function onItineraryClicked() {
        var itineraryId = this.getAttribute('data-itinerary');
        var itinerary = getItineraryById(itineraryId);
        events.trigger(eventNames.itineraryClicked, itinerary);
    }

    /**
     * Handle hover event on itinerary list item
     */
    function onItineraryHover() {
        var itineraryId = this.getAttribute('data-itinerary');
        var itinerary = getItineraryById(itineraryId);
        events.trigger(eventNames.itineraryHover, itinerary);
    }

    function show() {
        $container.removeClass('hidden');
    }

    /**
     * Show/hide all itineraries
     *
     * @param {Boolean} show If false, will make all itineraries transparent (hide them)
     */
    function showItineraries(show) {
        for (var i in itineraries) {
            itineraries[i].show(show);
        }
    }

    function hide() {
        $container.addClass('hidden');
    }

    function toggle() {
        if ($container.hasClass('hidden')) {
            show();
        } else {
            hide();
        }
    }
})(_, jQuery, Handlebars, CAC.Utils);
