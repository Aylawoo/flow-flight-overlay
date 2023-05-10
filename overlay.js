// ---- API function shorthands
let get = this.$api.variables.get,
    get_airport = this.$api.airports.find_airport_by_icao;

let ds_export = this.$api.datastore.export,
    ds_import = this.$api.datastore.import;

// ---- Script variables
const VERSION = "0.20.3";

const SIMBRIEF_URL = "https://www.simbrief.com/api/xml.fetcher.php?username=";

const BOX = "checkbox",
    TXT = "text";

let container = null,
    var_list = null,
    logo_container = null,
    logo_icon = null,
    type_label = null,
    registration_label = null,
    iata_label = null,
    origin_label = null,
    destination_label = null,
    distance_label = null,
    distance_pad = null,
    rules_label = null,
    network_label = null,
    airspeed_label = null,
    airspeed_pad = null,
    vertspeed_label = null,
    vertspeed_pad = null,
    vertspeed_alt = null,
    vs_icon = null,
    altitude_label = null,
    altitude_pad = null,
    heading_label = null,
    wind_label = null,
    wind_label_2 = null,
    wind_pad = null,
    wind_icon = null,
    oat_label = null,
    oat_pad = null,
    oat_icon = null,
    custom_label = null,
    custom_icon = null;

let label_list = null,
    itext_list = null,
    invisible_list = null,
    pad_list = null,
    icon_list = null;

this.enabled_items = [];
this.disabled_items = [];

// -- Global flight variables
let metric = false;
let target_airport = null;
let ap_lat = null;
let ap_lon = null;
let distance = "---";
let relative_wind = 0;
let wind_speed = 0;

/*
    Time since last SimBrief refresh.
    Setting this to "now" upon script load will prevent sending bad/unwanted requests
    on the first load of the script.
*/
let sb_refresh_timer = Date.now();

let rules_choice = 0;

this.settings = {};

// ---- Helper functions
// -- Base
/**
 * Ignore harmless TypeError on hot reloads when data isn't available fast enough
 * and re-throw any other error.
 * @param {Error} e passed Error
 */
function ignore_type_error(e) {
    if (e instanceof TypeError) {
    } else {
        throw e;
    }
}

// -- Math
/**
 * Clamp a number.
 * @param {number} number Input number
 * @param {number} min Minimum value
 * @param {number} max Maximum value
 * @returns {number} Clamped number
 */
function clamp(number, min, max) {
    return Math.min(Math.max(number, min), max);
}

/**
 * Convert degrees to radians.
 * @param {number} number Value in degrees
 * @returns {number} Value in radians
 */
function deg_to_rad(number) {
    return number * (Math.PI / 180);
}

/**
 * Calculate distance from two lat/long pairs in nautical miles.
 * @param {number} lat_a First position latitude
 * @param {number} lon_a First position longitutde
 * @param {number} lat_b Second position latitude
 * @param {number} lon_b Second position longitude
 * @returns {number}
 */
function calc_distance(lat_a, lon_a, lat_b, lon_b) {
    let radius = 6371;

    let total_lat = lat_b - lat_a;
    let total_lon = lon_b - lon_a;
    total_lat = deg_to_rad(total_lat);
    total_lon = deg_to_rad(total_lon);

    let step_one =
        Math.sin(total_lat / 2) * Math.sin(total_lat / 2) +
        Math.cos(deg_to_rad(lat_a)) *
            Math.cos(deg_to_rad(lat_b)) *
            Math.sin(total_lon / 2) *
            Math.sin(total_lon / 2);

    let step_two = 2 * Math.atan2(Math.sqrt(step_one), Math.sqrt(1 - step_one));

    return (radius * step_two) / 1.852;
}

// -- Settings
/**
 * Define setting options for Flow.
 * @param {Object} store Local datastore object
 * @param {string} setting_name Datastore name of the setting being defined
 * @param {string} ui_desc Description string for the Flow widget editor
 * @param {string} input_type Either "checkbox" or "text" for Flow widget editor
 * @param {string} ui_label Setting name for the Flow widget editor
 * @param {Array} enabled Local enabled_items Array
 * @param {Array} disabled Local disabled_items Array
 * @returns {Object} A Flow `settings` hashmap for use with `settings_define`
 */
function define_option(
    store,
    setting_name,
    ui_desc,
    input_type,
    ui_label,
    enabled,
    disabled
) {
    return {
        type: input_type,
        label: ui_label,
        value: store[setting_name],
        description: ui_desc,

        changed: (value) => {
            store[setting_name] = value;

            if (setting_name.includes("_enabled") && setting_name != "simbrief_enabled") {
                let item_name = setting_name.split("_")[0];
                toggle_element(`#streamer_overlay_${item_name}`, value);
                toggle_lists(item_name, value, enabled, disabled);
            }

            set_styles(store);
            ds_export(store);
        },
    };
}

/**
 * Export local datastore and update settings for the Flow widget editor.
 * @param {Object} store Local datastore
 * @param {Object} settings Local settings hashmap
 */
function export_settings(store, settings) {
    ds_export(store);
    for (let item in settings) {
        settings[item].value = store[item];
    }
    settings_define(settings);
}

/**
 * Swap an item between enabled_items and disabled_items lists.
 * @param {string} item Item to be enabled/disabled
 * @param {boolean} value Whether item is enabled (true) or disabled (false)
 * @param {Array} enabled Local enabled_items Array
 * @param {Array} disabled Local disabled_items Array
 */
function toggle_lists(item, value, enabled, disabled) {
    if (value) {
        enabled.push(item);
        disabled.splice(disabled.indexOf(item), 1);
    } else {
        disabled.push(item);
        enabled.splice(enabled.indexOf(item), 1);
    }
}

/**
 * Return an array of UI name and description for a given `setting` based on a predefined
 * list of pairs. Falling back to the given `setting` name and no description.
 * @param {string} setting The setting to return info for
 * @returns {Array} String array of [name, description]
 */
function set_info(setting) {
    switch (setting) {
        case "METRIC UNITS":
            return [setting, "Use metric units (km/h, m/s, km)"];
        case "SIMBRIEF ENABLED":
            return [
                setting,
                "Enable SimBrief integration (Mouse scroll on widget in wheel)",
            ];
        case "TYPE ENABLED":
            return ["AIRCRAFT TYPE ENABLED", "Display your aircraft type"];
        case "TYPE":
            return ["AIRCRAFT TYPE", ""];
        case "REGISTRATION ENABLED":
            return [setting, "Display your aircraft's registration"];
        case "REGISTRATION":
            return ["AIRCRAFT REGISTRATION", ""];
        case "IATA ENABLED":
            return ["IATA (AIRLINE) ENABLED", "Display your airline's IATA code or name"];
        case "IATA":
            return ["IATA (AIRLINE)", ""];
        case "ORIGIN ENABLED":
            return ["DEPARTURE ENABLED", "Display departure location ICAO or name"];
        case "ORIGIN":
            return ["DEPARTURE", ""];
        case "DESTINATION ENABLED":
            return ["DESTINATION ENABLED", "Display destination ICAO or name"];
        case "DESTINATION":
            return [setting, ""];
        case "DISTANCE ENABLED":
            return [
                setting,
                "Display the distance remaining to your DESTINATION if set to an ICAO",
            ];
        case "RULES ENABLED":
            return ["FLIGHT RULES ENABLED", "Enable display of flight rules"];
        case "RULES":
            return ["FLIGHT RULES", "VFR, SVFR, IFR"];
        case "NETWORK ENABLED":
            return [setting, "Display current multiplayer network"];
        case "NETWORK":
            return [setting, "Multiplayer, VATSIM, etc."];
        case "AIRSPEED ENABLED":
            return ["IAS ENABLED", "Display current indicated airspeed"];
        case "VERTSPEED ENABLED":
            return ["VERTICAL SPEED ENABLED", "Display current vertical speed"];
        case "ALTITUDE ENABLED":
            return [setting, "Display current aircraft altitude"];
        case "HEADING ENABLED":
            return [setting, "Display current aircraft heading"];
        case "WIND ENABLED":
            return [setting, "Display current wind direction and speed"];
        case "OAT ENABLED":
            return [setting, "Display current outside air temperature"];
        case "OAT FAHRENHEIT":
            return ["OAT IN FAHRENHEIT", "Use Fahrenheit for OAT"];
        case "CUSTOM ENABLED":
            return ["CUSTOM TEXTBOX ENABLED", "Display a customizable text box"];
        case "CUSTOM ICON":
            return ["CUSTOM BOX ICON NAME", "MDI icon name for custom text box"];
        case "CUSTOM":
            return ["CUSTOM TEXT", "Content of custom text box"];
        case "PAD NUMBERS":
            return [setting, "Maintain fixed width for data fields such as IAS"];
        case "PAD WITH ZEROES":
            return [setting, "Display leading zeroes if PAD NUMBERS is enabled"];
        case "FONT SIZE":
            return ["FONT (UI) SCALE", "Size of overlay font (in pixels); UI scale"];
        case "OVERLAY BOTTOM":
            return [
                "OVERLAY ON BOTTOM",
                "Display the overlay on the bottom of the screen",
            ];
        case "DISPLAY ICONS":
            return [
                "USE ICONS",
                "Display icons instead of text labels for overlay items",
            ];
        case "BLACK ICONS":
            return ["DARK MODE ICONS", "Display icons in dark mode"];
        case "LOGO ENABLED":
            return ["FLOW LOGO ENABLED", "Display Flow branding in overlay"];
        case "OUTLINE TEXT":
            return ["EMPHASIZE TEXT", "Display dark outline around overlay text"];
        case "COLOR WRAPPER":
            return ["BACKGROUND COLOR", "Overlay background color"];
        case "COLOR OUTLINE":
            return ["ITEM OUTLINE COLOR", "Overlay item outline color"];
        case "COLOR BACKGROUND":
            return ["ITEM BACKGROUND COLOR", "Overlay item background color"];
        case "COLOR TEXT":
            return ["FONT COLOR", "Overlay text color"];
        default:
            return [setting, ""];
    }
}

/**
 * Populate local enabled_items and disabled_items Arrays based on given `store`
 * datastore object, and return an initial `settings_define` compatible Object.
 * @param {Object} store Local datastore
 * @param {Array} enabled Local enabled_items Array
 * @param {Array} disabled Local disabled_items Array
 * @returns {Object} Object compatible with Flow `settings_define`
 */
function load_enabled(store, enabled, disabled) {
    let settings = {};
    for (let item in store) {
        if (item == "overlay_toggle") {
            continue;
        }

        let enable_switch = typeof store[item] === "boolean";
        let setting_name = item.split("_").join(" ").toUpperCase();

        let [name, desc] = set_info(setting_name);

        settings[item] = define_option(
            store,
            item,
            desc,
            enable_switch ? BOX : TXT,
            name,
            enabled,
            disabled
        );

        // Skip non-display items and setting values
        if (!enable_switch || item == "simbrief_enabled") {
            continue;
        }

        let item_name = item.split("_")[0];

        if (store[item] == true) {
            enabled.push(item_name);
        } else {
            disabled.push(item_name);
        }
    }

    return settings;
}

/**
 * Load the most recent flight plan from a user's SimBrief account.
 * @param {Object} store Local datastore
 * @param {Object} settings Local settings hashmap
 */
function load_simbrief(store, settings) {
    if (!store.simbrief_enabled) {
        return false;
    }

    fetch(`${SIMBRIEF_URL}${store.simbrief_username}&json=1`)
        .then((response) => response.json())
        .then((data) => {
            store.type = data.aircraft.icaocode;
            store.registration = data.aircraft.reg;
            store.origin = data.origin.icao_code;
            store.destination = data.destination.icao_code;
            store.iata = `${data.general.icao_airline} - ${data.atc.callsign}`;
            export_settings(store, settings);
        });
}

/**
 * Set a basic setting from Otto search.
 * @param {Object} store Local datastore
 * @param {Object} settings Local settings hashmap
 * @param {string} item Local datastore setting name
 * @param {any} value Value to set `item` to within `store` and `settings`
 */
function otto_set(store, settings, item, value) {
    store[item] = value;
    export_settings(store, settings);
}

/**
 * Set a complex setting from Otto search, then refresh the UI to reflect changes.
 * @param {Object} store Local datastore
 * @param {Object} settings Local settings hashmap
 * @param {Array} enabled Local enabled_items Array
 * @param {Array} disabled Local disabled_items Array
 * @param {string} item Local datastore setting name
 * @param {any} value Value to set `item` to within `store` and `settings`
 */
function otto_set_enabled(store, settings, enabled, disabled, item, value) {
    store[item + "_enabled"] = value;
    export_settings(store, settings);
    toggle_lists(item, value, enabled, disabled);
    load_views(enabled, disabled);
}

/**
 * Split and re-join Otto query parameters.
 * @param {Array} params Otto query parameters
 * @returns {string} Joined string of user input without prefix and setting name
 */
function otto_split(params) {
    return params.slice(2).join(" ");
}

// -- Visual
/**
 * Load and set display style of each item within local `enabled_items` and `disabled_items`.
 * @param {Array} enabled Local enabled_items Array
 * @param {Array} disabled Local disabled_items Array
 */
function load_views(enabled, disabled) {
    for (let item of disabled) {
        let elem = document.querySelector(`#streamer_overlay_${item}`);

        try {
            elem.style.display = "none";
        } catch (e) {
            ignore_type_error(e);
        }
    }

    for (let item of enabled) {
        let elem = document.querySelector(`#streamer_overlay_${item}`);

        try {
            elem.style.display = "inline-flex";
        } catch (e) {
            ignore_type_error(e);
        }
    }
}

/**
 * Resize UI elements to reflect chosen settings.
 * @param {Object} store Local datastore
 */
function resize_ui(store) {
    if (
        !label_list ||
        !itext_list ||
        !pad_list ||
        !icon_list ||
        !invisible_list ||
        !logo_icon
    ) {
        return;
    }

    label_list.forEach((label) => {
        label.style.fontSize = Math.round(store.font_size * 0.75) + "px";
    });
    itext_list.forEach((itext) => {
        itext.style.fontSize = store.font_size + "px";
    });
    invisible_list.forEach((invis) => {
        invis.style.fontSize = store.font_size + "px";
    });
    pad_list.forEach((pad) => {
        pad.style.fontSize = store.font_size + "px";
    });
    icon_list.forEach((icon) => {
        icon.style.width = store.font_size + "px";
        icon.style.height = store.font_size + "px";
    });

    logo_icon.style.width = store.font_size * 2 + "px";
}

/**
 * Handle mousewheel scroll to change UI scale.
 * @param {Object} store Local datastore
 * @param {Object} settings Local settings hashmap
 * @param {Object} event Scroll event
 */
function scroll_handler(store, settings, event) {
    event.deltaY < 0 ? (store.font_size += 1) : (store.font_size -= 1);
    store.font_size = clamp(store.font_size, 8, 128);
    export_settings(store, settings);
    resize_ui(store);
}

/**
 * Set on-click handlers for given UI items
 * @param {Object} store Local datastore
 * @param {Object} settings Local settings hashmap
 * @param {Object} item Array of elements returned from `document.querySelectorAll`
 */
function set_overlay_onclick(store, settings, item) {
    switch (item.id) {
        case "streamer_overlay_rules":
            item.onclick = () => {
                store.rules = ["VFR", "IFR", "SVFR"][rules_choice];
                export_settings(store, settings);
                rules_choice = (rules_choice + 1) % 3;
            };
            break;
        case "streamer_overlay_oat":
            item.onclick = () => {
                store.oat_fahrenheit = !store.oat_fahrenheit;
                export_settings(store, settings);
            };
            break;
    }
}

/**
 * Set selected element styles for the entire UI.
 * @param {Object} store Local datastore
 * @returns {any}
 */
function set_styles(store) {
    if (!label_list || !itext_list || !pad_list || !icon_list || !invisible_list) {
        return;
    }

    let items = document.querySelectorAll(
        "#streamer_overlay_vars > .streamer_overlay_item"
    );

    var_list.style.backgroundColor = store.color_wrapper;

    if (store.outline_text) {
        var_list.classList.add("streamer_overlay_outline");
    } else {
        var_list.classList.remove("streamer_overlay_outline");
    }

    label_list.forEach((label) => {
        label.style.display = store.display_icons ? "none" : "inline-flex";
        label.style.color = store.color_text;
        if (store.outline_text) {
            label.classList.add("streamer_overlay_outline");
        } else {
            label.classList.remove("streamer_overlay_outline");
        }
    });
    items.forEach((item) => {
        item.style.borderColor = store.color_outline;
        item.style.backgroundColor = store.color_background;
    });
    itext_list.forEach((itext) => {
        itext.style.color = store.color_text;
    });
    invisible_list.forEach((invis) => {
        invis.style.color = store.color_text;
    });
    pad_list.forEach((pad) => {
        pad.style.color = store.color_text;
    });
    icon_list.forEach((icon) => {
        icon.style.display = store.display_icons ? "inline-flex" : "none";
        icon.style.filter = store.black_icons ? "invert(0%)" : "invert(100%)";
    });

    toggle_element("#streamer_logo_container", store.logo_enabled);
}

/**
 * Toggle visibility of leading zeroes for number padding.
 * @param {Array} items List of padding elements
 * @param {boolean} status Whether or not to display number padding
 */
function toggle_pad_visibility(items, status) {
    items.forEach((item) => {
        item.style.opacity = status ? 1 : 0;
    });
}

/**
 * Toggle display visibility of given HTML element.
 * @param {Object} elem HTML element to toggle visibility of
 * @param {boolean} value Whether or not to display given element
 */
function toggle_element(elem, value) {
    element = document.querySelector(elem);
    element.style.display = value ? "inline-flex" : "none";
}

/**
 * Set screen location of the overlay
 * @param {Object} elem HTML element to toggle location of (Should always be `container`)
 * @param {boolean} bottom Whether or not the overlay is positioned on bottom of screen
 */
function set_overlay_location(elem, bottom) {
    elem.style.alignSelf = bottom ? "flex-end" : "flex-start";
}

// -- Number padding
/**
 * Pad a number with leading zeroes to be a specified final character count while
 * maintaining number sign.
 * @param {number} number Number to apply padding to
 * @param {number} target_length Desired final number length
 * @returns {string} Number with padding applied as a string
 */
function pad_number(number, target_length) {
    if (Math.sign(number) >= 0) {
        return number.toString().padStart(target_length, "0");
    } else {
        return (
            "-" +
            Math.abs(number)
                .toString()
                .padStart(target_length - 1, "0")
        );
    }
}

/**
 * Calcuate required number of padding characters for a number to reach `target_length`.
 * @param {number} number Number requiring padding
 * @param {number} target_length Desired final number length
 * @returns {number} Required number of padding characters to reach `target_length`
 */
function pad_required(number, target_length) {
    let required = number.toString().length;
    return required > 0 ? target_length - required : 0;
}

/**
 * Remove padding from a given Array of padding strings.
 * @param {Array} pad_items List of padding strings
 */
function reset_padding(pad_items) {
    pad_items.forEach((pad) => {
        pad.innerText = "";
    });
}

// -- Settings init
/**
 * Initialize the local datastore, each display item is a pair of <name> strings and
 * <name>_enabled bools, this allows programmatically setting the `this.enabled_items`
 * list easily.
 * @returns {Object} Initial local datastore object
 */
function init_store() {
    return {
        overlay_toggle: true,
        metric_units: false,
        simbrief_enabled: false,
        simbrief_username: "Default",
        type_enabled: false,
        type: "C172",
        registration_enabled: false,
        registration: "N172SP",
        iata_enabled: false,
        iata: "My Airline",
        origin_enabled: true,
        origin: "----",
        destination_enabled: true,
        destination: "----",
        distance_enabled: true,
        rules_enabled: false,
        rules: "VFR",
        network_enabled: false,
        network: "Multiplayer",
        airspeed_enabled: true,
        vertspeed_enabled: true,
        altitude_enabled: true,
        heading_enabled: true,
        wind_enabled: false,
        oat_enabled: false,
        oat_fahrenheit: false,
        custom_enabled: false,
        custom_icon: "note-text",
        custom: "Change me!",
        pad_numbers: true,
        pad_with_zeroes: false,
        font_size: 23,
        overlay_bottom: false,
        display_icons: true,
        black_icons: false,
        logo_enabled: true,
        outline_text: true,
        color_wrapper: "#00000090",
        color_outline: "#A0A0A0FF",
        color_background: "#00000090",
        color_text: "#FFFFFFFF",
    };
}

/**
 * Initialize the custom properties of the provided `settings` hashmap.
 * @param {Object} store Local datastore
 * @param {Object} settings Local settings hashmap
 */
function init_settings(store, settings) {
    settings.destination.changed = (value) => {
        store.destination = value;
        export_settings(store, settings);
        target_airport = null;
    };

    settings.custom_enabled.changed = (value) => {
        store.custom_enabled = value;
        export_settings(store, settings);
        toggle_element("#streamer_overlay_custom", value);
        toggle_element("#streamer_overlay_custom > .streamer_overlay_label", value);
        toggle_lists("custom", value, this.enabled_items, this.disabled_items);
    };

    settings.custom_icon.changed = (value) => {
        store.custom_icon = value;
        export_settings(store, settings);
        custom_icon.src = `mdi/icons/${value}.svg`;
    };

    settings.pad_with_zeroes.changed = (value) => {
        store.pad_with_zeroes = value;
        export_settings(store, settings);
        toggle_pad_visibility(pad_list, value);
    };

    settings.font_size.changed = (value) => {
        store.font_size = clamp(value, 8, 128);
        export_settings(store, settings);
        resize_ui(store);
    };

    settings.overlay_bottom.changed = (value) => {
        store.overlay_bottom = value;
        export_settings(store, settings);
        set_overlay_location(container, store.overlay_bottom);
    };

    settings.display_icons.changed = (value) => {
        store.display_icons = value;
        export_settings(store, settings);
        set_styles(store);
    };

    settings.logo_enabled.changed = (value) => {
        store.logo_enabled = value;
        export_settings(store, settings);
        toggle_element("#streamer_logo_container", value);
    };
}

// ---- Load configuration
this.store = init_store();
ds_import(this.store);

this.settings = load_enabled(this.store, this.enabled_items, this.disabled_items);
init_settings(this.store, this.settings);
settings_define(this.settings);

// ---- Events
// -- Flow initialization
run((event) => {
    this.store.overlay_toggle = !this.store.overlay_toggle;
    container.style.visibility = this.store.overlay_toggle ? "visible" : "hidden";

    toggle_pad_visibility(
        invisible_list,
        this.store.overlay_toggle && this.store.pad_with_zeroes
    );

    export_settings(this.store, this.settings);
});

// -- Flow wheel mouse scroll behavior
scroll((event) => {
    // Click wheel to update SimBrief
    if (!this.store.simbrief_enabled || this.store.simbrief_username === "Default") {
        return false;
    }

    // Only allow updating SimBrief once per 20s
    let now = Date.now();
    let time_since_refresh = (now - sb_refresh_timer) / 1000;

    if (time_since_refresh < 20) {
        return false;
    }

    // We're going to send a request to SimBrief, reset the timer
    sb_refresh_timer = now;

    load_simbrief(this.store, this.settings);
});

// -- Flow wheel widget icon state
state(() => {
    return this.store.overlay_toggle ? "mdi:airplane-check" : "mdi:airplane-off";
});

// -- Flow wheel center hub information
info(() => {
    if (!this.store.overlay_toggle) {
        return "Overlay disabled";
    } else {
        if (this.store.simbrief_enabled) {
            if (this.store.simbrief_username === "Default") {
                return "Please set SimBrief username";
            }

            let now = Date.now();
            let time = 20 - Math.round((now - sb_refresh_timer) / 1000);
            return time > 0 ? `SimBrief available in ${time}s` : "Overlay enabled";
        }
        return "Overlay enabled";
    }
});

// -- Flow wheel icon style
style(() => {
    return this.store.overlay_toggle ? "active" : null;
});

// -- Otto search
search(["overlay", "ol"], (query, callback) => {
    if (!query) {
        return true;
    }

    let params = query.split(" ");
    if (!params[1]) {
        return true;
    }

    let results = [];

    switch (params[1].toUpperCase()) {
        case "UNIT":
        case "UNITS":
        case "IMPERIAL":
        case "METRIC":
            results.push({
                uid: "overlay_otto_0",
                label: "Use metric units (km/h, m/s, km)",
                execute: () => {
                    otto_set(this.store, this.settings, "metric_units", true);
                },
            });
            results.push({
                uid: "overlay_otto_1",
                label: "Use imperial units (kt, fpm, nm)",
                execute: () => {
                    otto_set(this.store, this.settings, "metric_units", false);
                },
            });
            break;
        case "SB":
        case "SIMBRIEF":
            if (params.length >= 3) {
                results.push({
                    uid: "overlay_otto_2",
                    label: `New SimBrief username: ${otto_split(params)}`,
                    subtext: "Activate to save",
                    execute: () => {
                        otto_set(
                            this.store,
                            this.settings,
                            "simbrief_username",
                            otto_split(params)
                        );
                        return true;
                    },
                });
            }
            results.push({
                uid: "overlay_otto_3",
                label: "SimBrief on",
                subtext: `SimBrief username: ${this.store.simbrief_username}`,
                execute: () => {
                    otto_set(this.store, this.settings, "simbrief_enabled", true);
                    return true;
                },
            });
            results.push({
                uid: "overlay_otto_4",
                label: "SimBrief off",
                execute: () => {
                    otto_set(this.store, this.settings, "simbrief_enabled", false);
                },
            });
            results.push({
                uid: "overlay_otto_5",
                label: "Refresh SimBrief data",
                subtext: "SimBrief must be on to have effect",
                execute: () => {
                    load_simbrief(this.store, this.settings);
                },
            });
            break;
        case "TYPE":
        case "AIRCRAFT":
        case "CRAFT":
        case "PLANE":
            if (params.length >= 3) {
                results.push({
                    uid: "overlay_otto_6",
                    label: `New aircraft type: ${otto_split(params)}`,
                    subtext: "Activate to save",
                    execute: () => {
                        otto_set(this.store, this.settings, "type", otto_split(params));
                    },
                });
            }
            results.push({
                uid: "overlay_otto_7",
                label: "Aircraft type on",
                subtext: `Current type: ${this.store.type}`,
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "type",
                        true
                    );
                },
            });
            results.push({
                uid: "overlay_otto_8",
                label: "Aircraft type off",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "type",
                        false
                    );
                },
            });
            break;
        case "REGISTRATION":
        case "REG":
        case "TAIL":
        case "#":
            if (params.length >= 3) {
                results.push({
                    uid: "overlay_otto_9",
                    label: `New registration: ${otto_split(params)}`,
                    subtext: "Activate to save",
                    execute: () => {
                        otto_set(
                            this.store,
                            this.settings,
                            "registration",
                            otto_split(params)
                        );
                    },
                });
            }
            results.push({
                uid: "overlay_otto_10",
                label: "Aircraft registration on",
                subtext: `Current regstration: ${this.store.registration}`,
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "registration",
                        true
                    );
                },
            });
            results.push({
                uid: "overlay_otto_11",
                label: "Aircraft registration off",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "registration",
                        false
                    );
                },
            });
            break;
        case "IATA":
        case "AIRLINE":
        case "COMPANY":
        case "VA":
            if (params.length >= 3) {
                results.push({
                    uid: "overlay_otto_12",
                    label: `New IATA (Airline): ${otto_split(params)}`,
                    subtext: "Activate to save",
                    execute: () => {
                        otto_set(this.store, this.settings, "iata", otto_split(params));
                    },
                });
            }
            results.push({
                uid: "overlay_otto_13",
                label: "IATA (Airline) on",
                subtext: `Current IATA (Airline): ${this.store.iata}`,
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "iata",
                        true
                    );
                },
            });
            results.push({
                uid: "overlay_otto_14",
                label: "IATA (Airline) off",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "iata",
                        false
                    );
                },
            });
            break;
        case "ORIGIN":
        case "OG":
        case "DEPARTURE":
        case "DEPART":
        case "DEP":
            if (params.length >= 3) {
                results.push({
                    uid: "overlay_otto_15",
                    label: `New departure: ${otto_split(params)}`,
                    subtext: "Activate to save",
                    execute: () => {
                        otto_set(this.store, this.settings, "origin", otto_split(params));
                    },
                });
            }
            results.push({
                uid: "overlay_otto_16",
                label: "Departure on",
                subtext: `Current departure: ${this.store.origin}`,
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "origin",
                        true
                    );
                },
            });
            results.push({
                uid: "overlay_otto_17",
                label: "Departure off",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "origin",
                        false
                    );
                },
            });
            break;
        case "DESTINATION":
        case "DEST":
        case "ARRIVAL":
        case "AR":
            if (params.length >= 3) {
                results.push({
                    uid: "overlay_otto_18",
                    label: `New destination: ${otto_split(params)}`,
                    subtext: "Activate to save",
                    execute: () => {
                        otto_set(
                            this.store,
                            this.settings,
                            "destination",
                            otto_split(params)
                        );
                        target_airport = null;
                    },
                });
            }
            results.push({
                uid: "overlay_otto_19",
                label: "Destination on",
                subtext: `Current destination: ${this.store.destination}`,
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "destination",
                        true
                    );
                },
            });
            results.push({
                uid: "overlay_otto_20",
                label: "Destination off",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "destination",
                        false
                    );
                },
            });
            break;
        case "DISTANCE":
        case "DIST":
        case "DTG":
            results.push({
                uid: "overlay_otto_21",
                label: "Distance on",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "distance",
                        true
                    );
                },
            });
            results.push({
                uid: "overlay_otto_22",
                label: "Distance off",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "distance",
                        false
                    );
                },
            });
            break;
        case "RULES":
        case "VFR":
        case "IFR":
        case "SVFR":
            if (params.length >= 3) {
                results.push({
                    uid: "overlay_otto_23",
                    label: `New ruels: ${otto_split(params)}`,
                    subtext: "Activate to save",
                    execute: () => {
                        otto_set(this.store, this.settings, "rules", otto_split(params));
                    },
                });
            }
            results.push({
                uid: "overlay_otto_24",
                label: "Rules on",
                subtext: `Current rules: ${this.store.rules}`,
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "rules",
                        true
                    );
                },
            });
            results.push({
                uid: "overlay_otto_25",
                label: "Rules off",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "rules",
                        false
                    );
                },
            });
            break;
        case "NETWORK":
        case "NET":
        case "NW":
            if (params.length >= 3) {
                results.push({
                    uid: "overlay_otto_26",
                    label: `New network: ${otto_split(params)}`,
                    subtext: "Activate to save",
                    execute: () => {
                        otto_set(
                            this.store,
                            this.settings,
                            "network",
                            otto_split(params)
                        );
                    },
                });
            }
            results.push({
                uid: "overlay_otto_27",
                label: "Network on",
                subtext: `Current network: ${this.store.network}`,
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "network",
                        true
                    );
                },
            });
            results.push({
                uid: "overlay_otto_28",
                label: "Network off",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "network",
                        false
                    );
                },
            });
            break;
        case "AIRSPEED":
        case "SPEED":
        case "SPD":
            results.push({
                uid: "overlay_otto_29",
                label: "Airspeed on",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "airspeed",
                        true
                    );
                },
            });
            results.push({
                uid: "overlay_otto_30",
                label: "Airspeed off",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "airspeed",
                        false
                    );
                },
            });
            break;
        case "VERTSPEED":
        case "VSPEED":
        case "VS":
            results.push({
                uid: "overlay_otto_31",
                label: "Vertical speed on",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "vertspeed",
                        true
                    );
                },
            });
            results.push({
                uid: "overlay_otto_32",
                label: "Vertspeed off",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "vertspeed",
                        false
                    );
                },
            });
            break;
        case "ALTITUDE":
        case "ALT":
            results.push({
                uid: "overlay_otto_33",
                label: "Altitude on",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "altitude",
                        true
                    );
                },
            });
            results.push({
                uid: "overlay_otto_34",
                label: "Altitude off",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "altitude",
                        false
                    );
                },
            });
            break;
        case "HEADING":
        case "HDG":
            results.push({
                uid: "overlay_otto_35",
                label: "Heading on",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "heading",
                        true
                    );
                },
            });
            results.push({
                uid: "overlay_otto_36",
                label: "Heading off",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "heading",
                        false
                    );
                },
            });
            break;
        case "WIND":
        case "WND":
            results.push({
                uid: "overlay_otto_37",
                label: "Wind on",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "wind",
                        true
                    );
                },
            });
            results.push({
                uid: "overlay_otto_38",
                label: "Wind off",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "wind",
                        false
                    );
                },
            });
            break;
        case "TEMPERATURE":
        case "TEMP":
        case "OAT":
            results.push({
                uid: "overlay_otto_39",
                label: "OAT on",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "oat",
                        true
                    );
                },
            });
            results.push({
                uid: "overlay_otto_40",
                label: "OAT off",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "oat",
                        false
                    );
                },
            });
            results.push({
                uid: "overlay_otto_41",
                label: "Fahrenheit on",
                execute: () => {
                    this.store.oat_fahrenheit = true;
                    export_settings(this.store, this.settings);
                },
            });
            results.push({
                uid: "overlay_otto_42",
                label: "Fahrenheit off",
                execute: () => {
                    this.store.oat_fahrenheit = false;
                    export_settings(this.store, this.settings);
                },
            });
            break;
        case "CUSTOM":
        case "CS":
            if (params.length >= 3) {
                results.push({
                    uid: "overlay_otto_43",
                    label: `Custom text: ${otto_split(params)}`,
                    subtext: "Activate to save",
                    execute: () => {
                        otto_set(this.store, this.settings, "custom", otto_split(params));
                    },
                });
            }
            results.push({
                uid: "overlay_otto_44",
                label: "Custom field on",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "custom",
                        true
                    );
                },
            });
            results.push({
                uid: "overlay_otto_45",
                label: "Custom field off",
                execute: () => {
                    otto_set_enabled(
                        this.store,
                        this.settings,
                        this.enabled_items,
                        this.disabled_items,
                        "custom",
                        false
                    );
                },
            });
            break;
        case "CSICON":
        case "CICON":
        case "CSI":
        case "CI":
            results.push({
                uid: "overlay_otto_46",
                label: `Custom icon: ${otto_split(params)}`,
                subtext: "Activate to save",
                execute: () => {
                    otto_set(
                        this.store,
                        this.settings,
                        "custom_icon",
                        otto_split(params)
                    );
                    custom_icon.src = `mdi/icons/${this.store.custom_icon}.svg`;
                },
            });
            break;
        case "PADDING":
        case "PAD":
            results.push({
                uid: "overlay_otto_47",
                label: "Pad number spacing on",
                execute: () => {
                    otto_set(this.store, this.settings, "pad_numbers", true);
                },
            });
            results.push({
                uid: "overlay_otto_48",
                label: "Pad number spacing off",
                execute: () => {
                    otto_set(this.store, this.settings, "pad_numbers", false);
                },
            });
            results.push({
                uid: "overlay_otto_49",
                label: "Pad with leading zeroes",
                execute: () => {
                    otto_set(this.store, this.settings, "pad_with_zeroes", true);
                    toggle_pad_visibility(pad_list, this.store.pad_with_zeroes);
                },
            });
            results.push({
                uid: "overlay_otto_50",
                label: "Pad with leading spaces",
                execute: () => {
                    otto_set(this.store, this.settings, "pad_with_zeroes", false);
                    toggle_pad_visibility(pad_list, this.store.pad_with_zeroes);
                },
            });
            break;
        case "FONT":
        case "SIZE":
        case "SCALE":
        case "UI":
            results.push({
                uid: "overlay_otto_51",
                label: "Increase font size by 1",
                subtext: `Current font size: ${this.store.font_size}`,
                execute: () => {
                    otto_set(
                        this.store,
                        this.settings,
                        "font_size",
                        this.store.font_size + 1
                    );
                    resize_ui(this.store);
                },
            });
            results.push({
                uid: "overlay_otto_52",
                label: "Decrease font size by 1",
                execute: () => {
                    otto_set(
                        this.store,
                        this.settings,
                        "font_size",
                        this.store.font_size - 1
                    );
                    resize_ui(this.store);
                },
            });
            break;
        case "POSITION":
        case "POS":
        case "TOP":
        case "BOTTOM":
            results.push({
                uid: "overlay_otto_53",
                label: "Overlay on top of screen",
                execute: () => {
                    otto_set(this.store, this.settings, "overlay_bottom", false);
                    set_overlay_location(container, this.store.overlay_bottom);
                },
            });
            results.push({
                uid: "overlay_otto_54",
                label: "Overlay on bottom of screen",
                execute: () => {
                    otto_set(this.store, this.settings, "overlay_bottom", true);
                    set_overlay_location(container, this.store.overlay_bottom);
                },
            });
            break;
        case "ICONS":
        case "ICON":
        case "ICO":
        case "LABELS":
            results.push({
                uid: "overlay_otto_55",
                label: "Icons on",
                execute: () => {
                    otto_set(this.store, this.settings, "display_icons", true);
                    set_styles(this.store);
                },
            });
            results.push({
                uid: "overlay_otto_56",
                label: "Icons off",
                execute: () => {
                    otto_set(this.store, this.settings, "display_icons", false);
                    set_styles(this.store);
                },
            });
            results.push({
                uid: "overlay_otto_57",
                label: "Use dark mode icons",
                execute: () => {
                    otto_set(this.store, this.settings, "black_icons", true);
                    set_styles(this.store);
                },
            });
            results.push({
                uid: "overlay_otto_58",
                label: "Use light mode icons",
                execute: () => {
                    otto_set(this.store, this.settings, "black_icons", false);
                    set_styles(this.store);
                },
            });
            break;
        case "FLOW":
        case "LOGO":
        case "BRAND":
            results.push({
                uid: "overlay_otto_59",
                label: "Flow logo on",
                execute: () => {
                    otto_set(this.store, this.settings, "logo_enabled", true);
                    toggle_element("#streamer_logo_container", true);
                },
            });
            results.push({
                uid: "overlay_otto_60",
                label: "Flow logo off",
                execute: () => {
                    otto_set(this.store, this.settings, "logo_enabled", false);
                    toggle_element("#streamer_logo_container", false);
                },
            });
            break;
        case "EMPHASIZE":
        case "EMPH":
        case "ET":
        case "TEXT":
        case "TXT":
            results.push({
                uid: "overlay_otto_61",
                label: "Text emphasis on",
                execute: () => {
                    otto_set(this.store, this.settings, "outline_text", true);
                    set_styles(this.store);
                },
            });
            results.push({
                uid: "overlay_otto_62",
                label: "Text emphasis off",
                execute: () => {
                    otto_set(this.store, this.settings, "outline_text", false);
                    set_styles(this.store);
                },
            });
            break;
        case "BACKGROUND":
        case "BGC":
        case "BG":
            results.push({
                uid: "overlay_otto_63",
                label: `New background color: ${otto_split(params)}`,
                subtext: "Activate to save",
                execute: () => {
                    otto_set(
                        this.store,
                        this.settings,
                        "color_wrapper",
                        otto_split(params)
                    );
                    set_styles(this.store);
                },
            });
            break;
        case "OUTLINE":
        case "OLC":
        case "OL":
            results.push({
                uid: "overlay_otto_64",
                label: `New outline color: ${otto_split(params)}`,
                subtext: "Activate to save",
                execute: () => {
                    otto_set(
                        this.store,
                        this.settings,
                        "color_outline",
                        otto_split(params)
                    );
                    set_styles(this.store);
                },
            });
            break;
        case "ITEM":
        case "ITC":
        case "IT":
            results.push({
                uid: "overlay_otto_65",
                label: `New item color: ${otto_split(params)}`,
                subtext: "Activate to save",
                execute: () => {
                    otto_set(
                        this.store,
                        this.settings,
                        "color_background",
                        otto_split(params)
                    );
                    set_styles(this.store);
                },
            });
            break;
        case "FOREGROUND":
        case "FGC":
        case "FG":
            results.push({
                uid: "overlay_otto_66",
                label: `New foreground color: ${otto_split(params)}`,
                subtext: "Activate to save",
                execute: () => {
                    otto_set(this.store, this.settings, "color_text", otto_split(params));
                    set_styles(this.store);
                },
            });
            break;
        default:
            break;
    }

    callback(results);
});

// -- Run once per second
loop_1hz(() => {
    metric = this.store.metric_units;

    let ac_lat = get("A:PLANE LATITUDE", "degrees");
    let ac_lon = get("A:PLANE LONGITUDE", "degrees");
    let ap_lat = null;
    let ap_lon = null;

    if (this.store.distance_enabled && this.store.destination != "----") {
        if (target_airport == null) {
            get_airport("streamer-overlay-lookup", this.store.destination, (results) => {
                target_airport = typeof results[0] != undefined ? results[0] : null;
            });
        }

        if (target_airport != null) {
            ap_lat = target_airport.lat;
            ap_lon = target_airport.lon;
            distance = Math.round(calc_distance(ac_lat, ac_lon, ap_lat, ap_lon));
        } else {
            distance = "---";
        }
    }

    // Don't calculate anything if the user is in slew mode
    if (get("A:IS SLEW ACTIVE", "number")) {
        return;
    }

    if (metric && distance != "---") {
        distance = Math.round(distance * 1.852);
    }

    let display_distance = distance;

    let airspeed = Math.round(get("A:AIRSPEED INDICATED", metric ? "kph" : "knots"));
    if (airspeed < 5) {
        airspeed = 0;
    }

    let vertspeed = Math.round(get("A:VERTICAL SPEED", metric ? "m/s" : "ft/min"));

    try {
        vs_threshold = metric ? 0.5 : 100;
        if (vertspeed <= -vs_threshold) {
            vs_icon.src = "mdi/icons/arrow-down-circle.svg";
            vertspeed_alt.innerText = "V/S:-";
        } else if (vertspeed >= vs_threshold) {
            vs_icon.src = "mdi/icons/arrow-up-circle.svg";
            vertspeed_alt.innerText = "V/S:+";
        } else {
            vs_icon.src = "mdi/icons/minus-circle.svg";
            vertspeed_alt.innerText = "V/S:=";
        }
    } catch (e) {
        ignore_type_error(e);
    }

    vertspeed = Math.abs(vertspeed);

    let altitude = Math.round(get("A:PLANE ALTITUDE", metric ? "meters" : "feet"));

    let heading = pad_number(
        Math.round(get("A:PLANE HEADING DEGREES MAGNETIC", "degrees")),
        3,
        "0"
    );

    let oat = Math.round(get("A:AMBIENT TEMPERATURE", "celsius"));

    try {
        if (oat <= 0) {
            oat_icon.src = "mdi/icons/snowflake-alert.svg";
        } else if (oat >= 37) {
            oat_icon.src = "mdi/icons/fire-alert.svg";
        } else {
            oat_icon.src = "mdi/icons/thermometer-lines.svg";
        }
    } catch (e) {
        ignore_type_error(e);
    }

    if (this.store.oat_fahrenheit) {
        oat = Math.round(oat * 1.8 + 32);
    }

    if (this.store.pad_numbers) {
        let vs_pad = pad_required(vertspeed, 4);

        try {
            if (distance != "---") {
                distance_pad.innerText = "0".repeat(pad_required(distance, 4));
            } else {
                distance_pad.innerText = "";
            }
            airspeed_pad.innerText = "0".repeat(pad_required(airspeed, 3));
            vertspeed_pad.innerText = "0".repeat(vs_pad);
            altitude_pad.innerText = "0".repeat(pad_required(altitude, 5));
            oat_pad.innerText = "0".repeat(pad_required(oat, 3));
        } catch (e) {
            ignore_type_error(e);
        }
    } else {
        reset_padding(pad_list);
    }

    try {
        type_label.innerText = this.store.type;
        registration_label.innerText = this.store.registration;
        iata_label.innerText = this.store.iata;
        origin_label.innerText = this.store.origin;
        destination_label.innerText = this.store.destination;
        distance_label.innerText = `${display_distance}${metric ? "km" : "nm"}`;
        rules_label.innerText = this.store.rules;
        network_label.innerText = this.store.network;
        airspeed_label.innerText = `${airspeed}${metric ? "km/h" : "kt"}`;
        vertspeed_label.innerText = `${vertspeed}${metric ? "m/s" : "fpm"}`;
        altitude_label.innerText = `${altitude}${metric ? "m" : "ft"}`;
        heading_label.innerText = heading;
        oat_label.innerText = `${oat}${this.store.oat_fahrenheit ? "f" : "c"}`;
        custom_label.innerText = this.store.custom;
    } catch (e) {
        ignore_type_error(e);
    }
});

// -- Run 15 times per second
loop_15hz(() => {
    metric = this.store.metric_units;

    let wind_direction = Math.round(get("A:AMBIENT WIND DIRECTION", "degrees"));
    wind_speed = Math.round(get("A:AMBIENT WIND VELOCITY", metric ? "kph" : "knots"));
    let compass = get("A:PLANE HEADING DEGREES GYRO", "degrees");
    relative_wind = -Math.abs((360 + (compass - wind_direction)) % 360) + 180;

    try {
        if (this.store.pad_numbers) {
            wind_pad.innerText = "0".repeat(pad_required(wind_speed, 3));
        } else {
            reset_padding(pad_list);
        }
        wind_label.innerText = `${pad_number(wind_direction, 3)}@`;
        wind_label_2.innerText = `${wind_speed}${metric ? "km/h" : "kt"}`;
        wind_icon.style.transform = `rotate(${relative_wind}deg)`;
    } catch (e) {
        ignore_type_error(e);
    }
});

// -- HTML creation event
html_created((el) => {
    container = el.querySelector("#streamer_overlay");
    logo_container = el.querySelector("#streamer_logo_container");
    logo_icon = el.querySelector(".streamer_overlay_logo");
    var_list = el.querySelector("#streamer_overlay_vars");
    type_label = el.querySelector("#streamer_overlay_type > .streamer_overlay_itext");
    registration_label = el.querySelector(
        "#streamer_overlay_registration .streamer_overlay_itext"
    );
    iata_label = el.querySelector("#streamer_overlay_iata .streamer_overlay_itext");
    origin_label = el.querySelector("#streamer_overlay_origin .streamer_overlay_itext");
    destination_label = el.querySelector(
        "#streamer_overlay_destination .streamer_overlay_itext"
    );
    distance_label = el.querySelector(
        "#streamer_overlay_distance .streamer_overlay_itext"
    );
    distance_pad = el.querySelector(
        "#streamer_overlay_distance .streamer_overlay_invisible"
    );
    rules_label = el.querySelector("#streamer_overlay_rules .streamer_overlay_itext");
    network_label = el.querySelector("#streamer_overlay_network .streamer_overlay_itext");
    airspeed_label = el.querySelector(
        "#streamer_overlay_airspeed .streamer_overlay_itext"
    );
    airspeed_pad = el.querySelector(
        "#streamer_overlay_airspeed .streamer_overlay_invisible"
    );
    vertspeed_label = el.querySelector(
        "#streamer_overlay_vertspeed .streamer_overlay_itext"
    );
    vertspeed_pad = el.querySelector(
        "#streamer_overlay_vertspeed .streamer_overlay_invisible"
    );
    vertspeed_alt = el.querySelector(
        "#streamer_overlay_vertspeed .streamer_overlay_label"
    );
    vs_icon = el.querySelector("#streamer_overlay_vertspeed > img");
    altitude_label = el.querySelector(
        "#streamer_overlay_altitude .streamer_overlay_itext"
    );
    altitude_pad = el.querySelector(
        "#streamer_overlay_altitude .streamer_overlay_invisible"
    );
    heading_label = el.querySelector("#streamer_overlay_heading .streamer_overlay_itext");
    wind_label = el.querySelector("#streamer_overlay_wind #streamer_overlay_wind1");
    wind_label_2 = el.querySelector("#streamer_overlay_wind #streamer_overlay_wind2");
    wind_pad = el.querySelector("#streamer_overlay_wind .streamer_overlay_invisible");
    wind_icon = el.querySelector("#streamer_overlay_wind > img");
    oat_label = el.querySelector("#streamer_overlay_oat .streamer_overlay_itext");
    oat_pad = el.querySelector("#streamer_overlay_oat .streamer_overlay_invisible");
    oat_icon = el.querySelector("#streamer_overlay_oat > img");
    custom_label = el.querySelector("#streamer_overlay_custom .streamer_overlay_itext");
    custom_icon = el.querySelector("#streamer_overlay_custom > img");

    container.style.visibility = this.store.overlay_toggle ? "visible" : "hidden";
    set_overlay_location(container, this.store.overlay_bottom);

    label_list = el.querySelectorAll(".streamer_overlay_label");
    itext_list = el.querySelectorAll(".streamer_overlay_itext");
    invisible_list = el.querySelectorAll(".streamer_overlay_invisible");
    pad_list = el.querySelectorAll(".streamer_overlay_invisible");
    icon_list = el.querySelectorAll(".streamer_overlay_mdi");

    el.onmousewheel = (event) => {
        scroll_handler(this.store, this.settings, event);
    };

    let panels = document.querySelectorAll(".streamer_overlay_item");

    panels.forEach((item) => {
        set_overlay_onclick(this.store, this.settings, item);
    });

    resize_ui(this.store);
    set_styles(this.store);
    load_views(this.enabled_items, this.disabled_items);
    custom_icon.src = `mdi/icons/${this.store.custom_icon}.svg`;
    reset_padding(pad_list);
    toggle_pad_visibility(pad_list, this.store.pad_with_zeroes);
});
