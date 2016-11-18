CAC.Pages.Home = (function ($, ModeOptions,  MapControl, Modal, ShareModal, TabControl, Templates,
                            UserPreferences, UrlRouter) {
    'use strict';

    var defaults = {
        selectors: {
            // modal
            optionsButton: '.btn-options',
            optionsModalClass: 'modal-options',

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

            homeLink: '.home-link',
            tabControl: '.tab-control',
            tabControlLink: '.nav-item'
        }
    };

    var options = {};
    var modeOptionsControl = null;
    var shareModal = null;
    var transitOptionsModal = null;

    var mapControl = null;
    var tabControl = null;
    var urlRouter = null;
    var directionsControl = null;

    function Home(params) {
        options = $.extend({}, defaults, params);
        modeOptionsControl = new ModeOptions();

        shareModal = new ShareModal({});

        transitOptionsModal = new Modal({
            modalClass: options.selectors.optionsModalClass,
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

        tabControl = new TabControl({
            router: urlRouter
        });

        mapControl = new MapControl({
            tabControl: tabControl
        });

        directionsControl = new CAC.Control.Directions({
            mapControl: mapControl,
            modeOptionsControl: modeOptionsControl,
            tabControl: tabControl,
            urlRouter: urlRouter
        });

        _setupEvents();
    };

    return Home;

    function _setupEvents() {
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

        $(options.selectors.tabControl).on('click', options.selectors.tabControlLink, function (event) {
            var tabId = $(this).data('tab-id');
            if (tabId === tabControl.TABS.EXPLORE) {
                event.preventDefault();
                event.stopPropagation();

                tabControl.setTab(tabControl.TABS.EXPLORE);
            }
        });
        $(options.selectors.homeLink).on('click', function (event) {
            event.preventDefault();
            event.stopPropagation();

            tabControl.setTab(tabControl.TABS.HOME);
        });

        // TODO: Adjust as necessary once user prefs strategy is decided
        $(document).ready(directionsControl.setFromUserPreferences());
    }

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

        // TODO: Enable once explore view exists
        // tabControl.setTab(tabControl.TABS.EXPLORE);
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

})(jQuery, CAC.Control.ModeOptions, CAC.Map.Control, CAC.Control.Modal, CAC.Share.ShareModal,
    CAC.Control.Tab, CAC.Home.Templates, CAC.User.Preferences, CAC.UrlRouting.UrlRouter);
