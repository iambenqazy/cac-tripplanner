CAC.Pages.Home = (function ($, ModeOptions,  MapControl, Modal, Templates, UserPreferences,
                            UrlRouter) {
    'use strict';

    var defaults = {
        selectors: {
            // modal
            optionsButton: '.btn-options',
            shareModalClass: 'modal-share',

            // destinations
            placeCard: '.place-card',
            placeCardDirectionsLink: '.place-card .place-action-go',
            placeList: '.place-list',

            map: '.the-map',

            // TODO: update or remove old selectors below
            errorClass: 'error',
            exploreForm: '#explore',
            exploreMode: '#exploreMode input',
            exploreOrigin: '#exploreOrigin',
            exploreTime: '#exploreTime',
            submitErrorModal: '#submit-error-modal',
            toggleButton: '.toggle-search button',
            toggleDirectionsButton: '#toggle-directions',
            toggleExploreButton: '#toggle-explore',
            typeaheadExplore: '#exploreOrigin',
        }
    };

    var options = {};
    var modeOptionsControl = null;
    var shareModal = null;
    var transitOptionsModal = null;

    var mapControl = null;
    var urlRouter = null;
    var directionsControl = null;

    // TODO: rework tab control
    var sidebarTabControl = null;

    function Home(params) {
        options = $.extend({}, defaults, params);
        modeOptionsControl = new ModeOptions();

        shareModal = new Modal({modalClass: options.selectors.shareModalClass});
        // TODO: Open share modal once view with button exists

        transitOptionsModal = new Modal({
            modalClass: options.selectors.shareModalClass,
            clickHandler: onOptionsModalItemClicked
        });
        $(options.selectors.optionsButton).on('click', transitOptionsModal.open);
    }

    /* TODO: update for redesign or remove
    var submitExplore = function(event) {
        event.preventDefault();
        var exploreTime = $(options.selectors.exploreTime).val();
        var mode = modeOptionsControl.getMode();
        var origin = UserPreferences.getPreference('originText');

        if (!origin) {
            $(options.selectors.exploreOrigin).addClass(options.selectors.errorClass);
        }

        // check if the input is in error status
        if ($(options.selectors.exploreOrigin).hasClass(options.selectors.errorClass)) {
            $(options.selectors.submitErrorModal).modal();
            return;
        }

        UserPreferences.setPreference('method', 'explore');
        UserPreferences.setPreference('exploreTime', exploreTime);
        UserPreferences.setPreference('mode', mode);

        window.location = '/map';
    };
    */

    Home.prototype.initialize = function () {
        urlRouter = new UrlRouter();

        // Map initialization logic and event binding
        // TODO: rework tab control
        sidebarTabControl = new CAC.Control.SidebarTab();

        mapControl = new MapControl({
            homepage: true,
            tabControl: sidebarTabControl
        });

        directionsControl = new CAC.Control.Directions({
            mapControl: mapControl,
            modeOptionsControl: modeOptionsControl,
            tabControl: sidebarTabControl,
            urlRouter: urlRouter
        });

        this.destinations = null;
        $(options.selectors.toggleButton).on('click', function() {
            var id = $(this).attr('id');
            setTab(id);
        });

        $(options.selectors.placeList).on('click',
                                          options.selectors.placeCardDirectionsLink,
                                          $.proxy(clickedDestination, this));

        mapControl.events.on(mapControl.eventNames.originMoved,
                             $.proxy(moveOrigin, this));

        mapControl.events.on(mapControl.eventNames.destinationMoved,
                             $.proxy(moveDestination, this));

        // Listen to window resize on mobile view; if map becomes visible, load tiles.
        if (!$(options.selectors.map).is(':visible')) {
            $(window).resize(function() {
                if ($(options.selectors.map).is(':visible')) {
                    if (!mapControl.isLoaded()) {
                        mapControl.loadMap.apply(mapControl, null);
                    }

                    // done listening to resizes after map loads
                    $(window).off('resize');
                }
            });
        }

        // TODO: re-enable loading settings from user preferences
        // once routing figured out. Currently there is no way to go back
        // to the home page, so if there is an origin and destination in
        // preferences, the app will jump directly to the map page with no way back.
        $(document).ready(directionsControl.setFromUserPreferences());
    };

    return Home;

    /**
     * When user clicks a destination, look it up, then redirect to its details in 'explore' tab.
     */
    function clickedDestination(event) {
        event.preventDefault();
        var mode = modeOptionsControl.getMode();
        var exploreTime = $(options.selectors.exploreTime).val();
        UserPreferences.setPreference('method', 'explore');
        UserPreferences.setPreference('exploreTime', exploreTime);
        UserPreferences.setPreference('mode', mode);

        var block = $(event.target).closest(options.selectors.placeCard);
        var placeId = block.data('destination-id');
        UserPreferences.setPreference('placeId', placeId);
        window.location = '/map';
    }

    function setTab(tab) {
        if (tab.indexOf('directions') > -1) {
            $(options.selectors.exploreForm).addClass('hidden');
            $(options.selectors.directionsForm).removeClass('hidden');
            $(options.selectors.toggleDirectionsButton).addClass('active');
            $(options.selectors.toggleExploreButton).removeClass('active');
        } else {
            $(options.selectors.directionsForm).addClass('hidden');
            $(options.selectors.exploreForm).removeClass('hidden');
            $(options.selectors.toggleDirectionsButton).removeClass('active');
            $(options.selectors.toggleExploreButton).addClass('active');
        }
    }

    function onOptionsModalItemClicked(event) {
        // TODO: implement modals
        console.log($(event.target).html());
    }

    function moveOrigin(event, position) {
        event.preventDefault();
        directionsControl.moveOriginDestination('origin', position);
    }

    function moveDestination(event, position) {
        event.preventDefault(); // necessary to prevent typeahead dropdown from opening
        directionsControl.moveOriginDestination('destination', position);
    }

})(jQuery, CAC.Control.ModeOptions, CAC.Map.Control, CAC.Control.Modal, CAC.Home.Templates, CAC.User.Preferences,
    CAC.UrlRouting.UrlRouter);
