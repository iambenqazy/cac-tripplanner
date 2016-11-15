CAC.User.Preferences = (function(Storages, _) {
    'use strict';

    // TODO: figure out local storage strategy
    // set up local storage
    // var namespaceStorage = Storages.initNamespaceStorage('cac_otp');
    // var storage = namespaceStorage.localStorage;

    // Initialize preference storage object.
    // Currently it just uses an 'options' dictionary, so preferences lives only as long as
    // the page for which this is initialized.
    // With this setup we have the flexibility to store all or some of the parameters to local
    // storage if we decide that's valuable, and components that use these parameters don't need
    // to know the difference.
    var options = {};
    var storage = {
        set: function (pref, val) { options[pref] = val; },
        get: function (pref) { return options[pref]; }
    };

    // store to use for default location
    var cityHall = {
        name: 'City Hall, Philadelphia, Pennsylvania, USA',
        extent: {
            xmax: -75.158978,
            xmin: -75.168978,
            ymax: 39.958449,
            ymin: 39.948449
        },
        feature: {
            attributes: {
                City: 'Philadelphia',
                Postal: '',
                Region: 'Pennsylvania',
                StAddr: '1450 John F Kennedy Blvd'
            },
            geometry: {
                x: -75.16397666699964,
                y: 39.95344911900048
            }
        }
    };

    var defaults = {
        arriveBy: false, // depart at set time, by default
        bikeTriangle: 'neutral',
        exploreTime: 20,
        maxWalk: 2,
        method: 'explore',
        mode: 'TRANSIT,WALK',
        origin: cityHall,
        originText: cityHall.name,
        destination: undefined,
        destinationText: '',
        waypoints: [],
        wheelchair: false
    };

    var module = {
        getPreference: getPreference,
        setPreference: setPreference,
        setLocation: setLocation,
        clearLocation: clearLocation
    };
    return module;

    /**
     * Fetch stored setting.
     *
     * @param {String} preference Name of setting to fetch
     * @param {Boolean} [setDefault=true] If false, don't set the default value if no value is set
     * @return {Object} setting found in storage, or default if none found
     */
    function getPreference(preference, setDefault) {
        var val = storage.get(preference);
        if (val) {
            val = JSON.parse(val);
        }

        // Default to true
        setDefault = _.isUndefined(setDefault) || setDefault;

        // If a typeahead is cleared, we want to grab the default
        if (setDefault && !val || val === '') {
            val = defaults[preference];
            setPreference(preference, val);
        }
        return val;
    }

    /**
     * Save user preference to local storage (or cookie, if local storage not supported).
     *
     * @param {String} preference Name of setting to store
     * @param {Object} val Setting value to store
     */
    function setPreference(preference, val) {
        storage.set(preference, JSON.stringify(val));
    }

    /**
     * Convenience method to avoid having to manually set both preferences for 'origin' and
     * destination.
     *
     * 'text' is optional and defaults to location.name if omitted
     */
    function setLocation(key, location, text) {
        setPreference(key, location);
        if (!_.isUndefined(text)) {
            setPreference(key + 'Text', text);
        } else {
            setPreference(key + 'Text', location.name);
        }
    }

    // Convenience method to clear 'origin' and 'destination'
    function clearLocation(key) {
        setPreference(key, undefined);
        setPreference(key + 'Text', undefined);
    }

})(Storages, _);
