// ---- API function shorthands
let get = this.$api.variables.get,
    get_server = this.$api.community.get_server,
    get_metar = this.$api.weather.find_metar_by_icao,
    get_airport = this.$api.airports.find_airport_by_icao;

let ds_export = this.$api.datastore.export,
    ds_import = this.$api.datastore.import;

let twitch_send = this.$api.twitch.send_message,
    twitch_connected = this.$api.twitch.is_connected;

// ---- Script variables
const VERSION = "0.8.5";

const SIMBRIEF_URL = "https://www.simbrief.com/api/xml.fetcher.php?username=";

const BOX = "checkbox",
      TXT = "text";

const non_visual = ["overlay_enabled", "simbrief_enabled"];

let container = null,
    var_list = null,
    type_label = null,
    registration_label = null,
    airline_label = null,
    origin_label = null,
    destination_label = null,
    distance_label = null,
    rules_label = null,
    network_label = null,
    ete_label = null,
    airspeed_label = null,
    vertspeed_label = null,
    altitude_label = null,
    heading_label = null;

let enabled_items = [],
    disabled_items = [];

// Global flight variables
let target_airport = null;
let ap_lat = null;
let ap_lon = null;
let distance = "---";

/*
    Time since last SimBrief refresh.
    Setting this to "now" upon script load will prevent sending bad/unwanted requests
    on the first load of the script.
*/
let sb_refresh_timer = Date.now();

// ---- Helper functions
function ignore_type_error(e) {
    // Ignore harmless TypeError on hot reloads when data isn't available fast enough
    if (e instanceof TypeError) {} else { throw e; }
}

function set_colors(store) {
    // Set custom element colors
    let var_list = document.querySelector("#streamer_overlay_vars");
    let items = document.querySelectorAll("#streamer_overlay_vars > span");
    let labels = document.querySelectorAll(".streamer_overlay_itext");

    var_list.style.backgroundColor = store.color_wrapper;

    items.forEach((item) => {
        item.style.borderColor = store.color_outline;
        item.style.backgroundColor = store.color_background;
    });

    labels.forEach((label) => {
        label.style.color = store.color_text;
    });
}

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

function define_option(storage, setting_name, input_type, ui_label, enabled, disabled) {
    // Define setting options for Flow
    return {
        type: input_type,
        label: ui_label,
        value: storage[setting_name],

        changed: (value) => {
            storage[setting_name] = value;

            if (setting_name.includes("_enabled") && !non_visual.includes(setting_name)) {
                let item_name = setting_name.split("_")[0];

                if (value) {
                    enabled.push(item_name);
                    disabled.splice(disabled.indexOf(item_name), 1);
                } else {
                    disabled.push(item_name);
                    enabled.splice(enabled.indexOf(item_name), 1);
                }
            }

            ds_export(storage);
        }
    };
}

function load_enabled(store, enabled, disabled) {
    let settings = {};
    for (let item in store) {
        let enable_switch = typeof store[item] === "boolean";
        let name = item.split("_").join(" ").toUpperCase();

        settings[item] = define_option(
            store,
            item,
            enable_switch ? BOX : TXT,
            name,
            enabled,
            disabled
        );

        // Skip non-display items and setting values
        if (!enable_switch || non_visual.includes(item)) {
            continue;
        }

        // Add values to the enabled/disabled lists
        let item_name = item.split("_")[0];

        if (store[item] == true) {
            enabled.push(item_name);
        } else {
            disabled.push(item_name);
        }
    }

    return settings;
}

function deg_to_rad(number) {
    // Convert degrees to radians
    return number * (Math.PI / 180);
}

function calc_distance(lat_a, lon_a, lat_b, lon_b) {
    // Calculate distance from two lat/long pairs in Nautical Miles
    let radius = 6371;

    let total_lat = lat_b - lat_a;
    let total_lon = lon_b - lon_a;
    total_lat = deg_to_rad(total_lat);
    total_lon = deg_to_rad(total_lon);

    let step_one =
        Math.sin(total_lat / 2) * Math.sin(total_lat / 2) +
        Math.cos(deg_to_rad(lat_a)) * Math.cos(deg_to_rad(lat_b)) *
        Math.sin(total_lon / 2) * Math.sin(total_lon / 2);

    let step_two = 2 * Math.atan2(Math.sqrt(step_one), Math.sqrt(1 - step_one));

    return (radius * step_two) / 1.852;
}

function pad_number(number, pad_amount, pad_char) {
    if (Math.sign(number) >= 0) {
        return number.toString().padStart(pad_amount, pad_char);
    } else {
        return "-" + Math.abs(number).toString().padStart(pad_amount, pad_char);
    }
}

function toggle_element(elem, value) {
    elem = document.querySelector(`#streamer_overlay_${elem}`);
    elem.style.display = value ? "inline-flex" : "none";
}

function icon_toggle(value) {
    let icons = document.querySelectorAll(".streamer_overlay_mdi");
    let labels = document.querySelectorAll(".streamer_overlay_label");

    for (i = 0; i < icons.length; i++) {
        icons[i].style.display = value ? "inline-flex" : "none";
        labels[i].style.display = value ? "none" : "inline-flex";
    }
}

// ---- Configuration
this.store = {
    /*
    Each display item is a pair of <name> strings and <name>_enabled bools.
    This allows programmatically setting the `enabled_items` list easily.
    */
    overlay_enabled: true,
    display_icons: true,
    overlay_bottom: false,
    simbrief_enabled: false,
    simbrief_username: "USERNAME",
    type_enabled: false,
    type: "C172",
    registration_enabled: false,
    registration: "N172SP",
    airline_enabled: false,
    airline: "My Airline",
    origin_enabled: true,
    origin: "----",
    destination_enabled: true,
    destination: "----",
    rules_enabled: false,
    rules: "VFR",
    network_enabled: false,
    network: "Multiplayer",
    ete_enabled: false,
    airspeed_enabled: true,
    pad_airspeed: true,
    vertspeed_enabled: true,
    pad_vertspeed: true,
    altitude_enabled: true,
    pad_altitude: true,
    heading_enabled: true,
    pad_heading: true,
    distance_enabled: true,
    pad_distance: true,
    outline_text: true,
    color_wrapper: "#00000090",
    color_outline: "#A0A0A0FF",
    color_background: "#00000090",
    color_text: "#FFFFFFFF"
};
ds_import(this.store);

// Take all config options and place them in a `settings` object
let settings = load_enabled(this.store, enabled_items, disabled_items);

settings.overlay_enabled.changed = (value) => {
    this.store.overlay_enabled = value;
    ds_export(this.store);
    container.style.visibility = value ? "visible" : "hidden";
};

settings.display_icons.changed = (value) => {
    this.store.display_icons = value;
    ds_export(this.store);
    icon_toggle(value);
};

settings.overlay_bottom.changed = (value) => {
    this.store.overlay_bottom = value;
    ds_export(this.store);
    container.style.alignSelf = (this.store.overlay_bottom ? "flex-end" : "flex-start");
};

settings.type_enabled.changed = (value) => {
    this.store.type_enabled = value;
    ds_export(this.store);
    toggle_element("type", value);
};

settings.registration_enabled.changed = (value) => {
    this.store.registration_enabled = value;
    ds_export(this.store);
    toggle_element("registration", value);
};

settings.airline_enabled.changed = (value) => {
    this.store.airline_enabled = value;
    ds_export(this.store);
    toggle_element("airline", value);
};

settings.origin_enabled.changed = (value) => {
    this.store.origin_enabled = value;
    ds_export(this.store);
    toggle_element("origin", value);
};

settings.destination_enabled.changed = (value) => {
    this.store.destination_enabled = value;
    ds_export(this.store);
    toggle_element("destination", value);
};

settings.destination.changed = (value) => {
    this.store.destination = value;
    ds_export(this.store);
    target_airport = null;
};

settings.rules_enabled.changed = (value) => {
    this.store.rules_enabled = value;
    ds_export(this.store);
    toggle_element("rules", value);
};

settings.network_enabled.changed = (value) => {
    this.store.network_enabled = value;
    ds_export(this.store);
    toggle_element("network", value);
};

settings.ete_enabled.changed = (value) => {
    this.store.ete_enabled = value;
    ds_export(this.store);
    toggle_element("ete", value);
};

settings.airspeed_enabled.changed = (value) => {
    this.store.airspeed_enabled = value;
    ds_export(this.store);
    toggle_element("airspeed", value);
};

settings.vertspeed_enabled.changed = (value) => {
    this.store.vertspeed_enabled = value;
    ds_export(this.store);
    toggle_element("vertspeed", value);
};

settings.altitude_enabled.changed = (value) => {
    this.store.altitude_enabled = value;
    ds_export(this.store);
    toggle_element("altitude", value);
};

settings.heading_enabled.changed = (value) => {
    this.store.heading_enabled = value;
    ds_export(this.store);
    toggle_element("heading", value);
};

settings.distance_enabled.changed = (value) => {
    this.store.distance_enabled = value;
    ds_export(this.store);
    toggle_element("distance", value);
};

settings.outline_text.changed = (value) => {
    this.store.outline_text = value;
    ds_export(this.store);
    if (value) {
        var_list.classList.add("streamer_overlay_outline");
    } else {
        var_list.classList.remove("streamer_overlay_outline");
    }
};

settings.color_wrapper.changed = (value) => {
    this.store.color_wrapper = value;
    ds_export(this.store);
    set_colors(this.store);
};

settings.color_outline.changed = (value) => {
    this.store.color_outline = value;
    ds_export(this.store);
    set_colors(this.store);
};

settings.color_background.changed = (value) => {
    this.store.color_background = value;
    ds_export(this.store);
    set_colors(this.store);
};

settings.color_text.changed = (value) => {
    this.store.color_text = value;
    ds_export(this.store);
    set_colors(this.store);
};

settings_define(settings);

// ---- Events
run((event) => {
    this.store.overlay_enabled = !this.store.overlay_enabled;
    container.style.visibility = this.store.overlay_enabled ? "visible" : "hidden";

    ds_export(this.store);
});

scroll((event) => {
    // Click wheel to update SimBrief, instead of toggle overlay
    if (!this.store.simbrief_enabled || this.store.simbrief_username === "USERNAME") {
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

    fetch(`${SIMBRIEF_URL}${this.store.simbrief_username}&json=1`)
        .then(response => response.json())
        .then(data => {
            this.store.type = data.aircraft.icaocode;
            this.store.registration = data.aircraft.reg;
            this.store.origin = data.origin.icao_code;
            this.store.destination = data.destination.icao_code;
            this.store.airline = `${data.general.icao_airline} - ${data.atc.callsign}`;
            ds_export(this.store);
        });
});

state(() => {
    return this.store.overlay_enabled ? "mdi:airplane-check" : "mdi:airplane-off";
});

info(() => {
    if (this.store.overlay_enabled) {
        // Display countdown for SimBrief refresh if applicable
        if (this.store.simbrief_enabled) {
            let now = Date.now();
            let time = 20 - Math.round((now - sb_refresh_timer) / 1000);

            return time > 0 ? `SimBrief available in ${time}s` : "Overlay enabled";
        }
        return "Overlay enabled";
    }
    return "Overlay disabled";
});

style(() => {
    return this.store.overlay_enabled ? "active" : null;
});

loop_1hz(() => {
    if (this.store.distance_enabled && this.store.destination != "----") {
        let ac_lat = get("A:PLANE LATITUDE", "degrees");
        let ac_lon = get("A:PLANE LONGITUDE", "degrees");

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
    if (get("A:IS SLEW ACTIVE", "number")) { return; };

    let groundspeed = 0;

    groundspeed = get("A:GROUND VELOCITY", "knots");

    // Simple ETE calculation
    let ete = 0;
    let date = new Date(0, 0);

    if (distance > 0 && groundspeed > 10) {
        ete = distance / groundspeed;
        // This will not work for spans greater than 99h99m
        date.setSeconds(ete === Infinity ? 0 : ete * 60 * 60);
    }

    // Update the rest of the labels
    let airspeed = Math.round(get("A:AIRSPEED INDICATED", "knots"));
    if (this.store.pad_airspeed) { airspeed = pad_number(airspeed, 3, "0"); }

    let vertspeed = Math.round(get("A:VERTICAL SPEED", "ft/min"));
    if (this.store.pad_vertspeed) { vertspeed = pad_number(vertspeed, 4, "0"); }

    let altitude = Math.round(get("A:PLANE ALTITUDE", "feet"));
    if (this.store.pad_altitude) { altitude = pad_number(altitude, 5, "0"); }

    let heading = Math.round(get("A:PLANE HEADING DEGREES MAGNETIC", "degrees"));
    if (this.store.pad_heading) { heading = pad_number(heading, 3, "0"); }

    let display_distance = distance
    if (distance != "---" && this.store.pad_distance) {
        display_distance = pad_number(distance, 4, "0");
    }

    try {
        ete_label.innerText = `${date.toTimeString().slice(0, 5)}`;
        airspeed_label.innerText = `${airspeed}kt`;
        vertspeed_label.innerText = `${vertspeed}fpm`;
        altitude_label.innerText = `${altitude}ft`;
        type_label.innerText = `${this.store.type}`;
        registration_label.innerText = `${this.store.registration}`;
        airline_label.innerText = `${this.store.airline}`;
        origin_label.innerText = `${this.store.origin}`;
        destination_label.innerText = `${this.store.destination}`;
        distance_label.innerText = `${display_distance}nm`;
        rules_label.innerText = `${this.store.rules}`;
        network_label.innerText = `${this.store.network}`;
        heading_label.innerText = `${heading}`;
    } catch (e) {
        ignore_type_error(e);
    }
});

html_created((el) => {
    // Get referneces to the overlay elements
    container = el.querySelector("#streamer_overlay");
    var_list = el.querySelector("#streamer_overlay_vars");
    type_label = el.querySelector(
      "#streamer_overlay_type > .streamer_overlay_itext"
    );
    registration_label = el.querySelector(
      "#streamer_overlay_registration .streamer_overlay_itext"
    );
    airline_label = el.querySelector(
      "#streamer_overlay_airline .streamer_overlay_itext"
    );
    origin_label = el.querySelector(
      "#streamer_overlay_origin .streamer_overlay_itext"
    );
    destination_label = el.querySelector(
      "#streamer_overlay_destination .streamer_overlay_itext"
    );
    distance_label = el.querySelector(
      "#streamer_overlay_distance .streamer_overlay_itext"
    );
    rules_label = el.querySelector(
      "#streamer_overlay_rules .streamer_overlay_itext"
    );
    network_label = el.querySelector(
      "#streamer_overlay_network .streamer_overlay_itext"
    );
    ete_label = el.querySelector(
      "#streamer_overlay_ete .streamer_overlay_itext"
    );
    airspeed_label = el.querySelector(
      "#streamer_overlay_airspeed .streamer_overlay_itext"
    );
    vertspeed_label = el.querySelector(
      "#streamer_overlay_vertspeed .streamer_overlay_itext"
    );
    altitude_label = el.querySelector(
      "#streamer_overlay_altitude .streamer_overlay_itext"
    );
    heading_label = el.querySelector(
      "#streamer_overlay_heading .streamer_overlay_itext"
    );

    set_colors(this.store);
    load_views(enabled_items, disabled_items);
    icon_toggle(this.store.display_icons);
});
