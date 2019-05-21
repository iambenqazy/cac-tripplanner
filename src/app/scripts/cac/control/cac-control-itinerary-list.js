/**
 *  View control for the itinerary list
 *
 */
CAC.Control.ItineraryList = (function (_, $, MapTemplates) {

    'use strict';

    var defaults = {
        // Should the back button be shown in the control
        //  this is weird, ideally we would handle the back button in the wrapper view, but we
        //  need to switch out the sidebar div as a whole
        showBackButton: false,
        // Should the share button be shown in the control
        showShareButton: false,
        selectors: {
            alert: '.alert',
            container: '.directions-list',
            hiddenClass: 'hidden',
            itineraryList: '.routes-list',
            itineraryItem: '.route-summary'
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
        itineraries = newItineraries;

        // Show the directions div and populate with itineraries
        var html = MapTemplates.itineraryList(itineraries);
        $container.html(html);

        enableCarousel(itineraries);

        $(options.selectors.itineraryItem).on('click', onItineraryClicked);
        $(options.selectors.itineraryItem).hover(onItineraryHover);
    }

    /**
     * Use in case OTP planner returns an error
     * @param {Object} Error object returned from OTP
     */
    function setItinerariesError(error) {

        // default message; will use in case OTP unresponsive
        var msg = 'Cannot currently plan trip. Please try again later.';

        // If OTP responded with an error, use its message
        if (error && error.msg) {
            msg = error.msg;
            // override default error message for out-of-bounds or non-navigable orign/destination
            if (msg.indexOf('Your start or end point might not be safely accessible') > -1) {
                msg = 'Make sure the origin and destination are accessible addresses within ' +
                      'the Greater Philadelphia area.';
            }
        }

        var alert = MapTemplates.alert(msg, 'Could not plan trip', 'danger');
        $container.html(alert);

        // handle alert close button click
        $container.one('click', options.selectors.alert, function() {
            $(options.selectors.alert).remove();
        });
    }

    /**
     * Enable carousel for swiping itineraries on mobile
     * @param {[object]} itineraries An open trip planner itinerary object, as returned from the plan endpoint
     */
    function enableCarousel(itineraries) {
        if (itineraries.length < 2) {
            return;
        }

        var slider = tns({
            container: options.selectors.itineraryList,
            autoplayButton: false,
            autoplayButtonOutput: false,
            autoplayPosition: 'top',
            controls: false,
            controlPosition: 'bottom',
            items: 1,
            nav: true,
            navPosition: 'bottom',
            slideBy: 'page',
            autoplay: false,
            autoHeight: true,
            responsive: {
                320: {disable: false, controls: false, nav: true, autoHeight: true},
                481: {disable: true}
            }
        });

        // Highlight route on map on itinerary carousel swipe
        slider.events.on('indexChanged', function(info) {
            var items = $(options.selectors.itineraryItem);
            if (items && items.length > info.displayIndex) {
                items.eq(info.displayIndex).triggerHandler('mouseenter');
            }
        });
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
        $container.removeClass(options.selectors.hiddenClass);
    }

    /**
     * Show/hide all itineraries
     *
     * @param {Boolean} show If false, will make all itineraries transparent (hide them)
     */
    function showItineraries(show) {
        _.forEach(itineraries, function(itinerary) {
            itinerary.show(show);
        });
    }

    function hide() {
        $container.addClass(options.selectors.hiddenClass);
    }

    function toggle() {
        if ($container.hasClass(options.selectors.hiddenClass)) {
            show();
        } else {
            hide();
        }
    }
})(_, jQuery, CAC.Map.Templates);
