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
const VERSION = "0.4.6";

const BOX = "checkbox",
      TXT = "text";

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

let non_visual = ["script_enabled", "simbrief_enabled"];

// Global flight variables
let target_airport = null;
let ap_lat = null;
let ap_lon = null;
let distance = null;

// ---- Helper functions
function set_colors(store) {
    // Set custom element colors
    let var_list = document.querySelector("#streamer_overlay_vars");
    let items = document.querySelectorAll("#streamer_overlay > div > span");

    var_list.style.backgroundColor = store.color_wrapper;

    items.forEach((item) => {
        item.style.color = store.color_text;
        item.style.borderColor = store.color_outline;
        item.style.backgroundColor = store.color_background;
    });
}

function load_views(enabled, disabled) {
    for (let item of disabled) {
        let elem = document.querySelector(`#streamer_overlay_${item}`);

        try {
            elem.style.display = "none";
        } catch (e) {
            // TypeError (null) expected occasionally on reloads, harmless
            if (e instanceof TypeError) {} else { console.error(e); }
        }
    }

    for (let item of enabled) {
        let elem = document.querySelector(`#streamer_overlay_${item}`);

        try {
            elem.style.display = "inline-flex";
        } catch (e) {
            // TypeError (null) expected occasionally on reloads, harmless
            if (e instanceof TypeError) {} else { console.error(e); }
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
            enable_switch ? BOX: TXT,
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

// ---- Configuration
this.store = {
    /*
    Each display item is a pair of <name> strings and <name>_enabled bools.
    This allows programmatically setting the `enabled_items` list easily.
    */
    script_enabled: true,
    simbrief_enabled: false,
    simbrief_username: "USERNAME",
    type_enabled: true,
    type: "C172",
    registration_enabled: true,
    registration: "N172SP",
    airline_enabled: false,
    airline: "My VA",
    origin_enabled: true,
    origin: "KPDX",
    destination_enabled: true,
    destination: "KSEA",
    rules_enabled: true,
    rules: "VFR",
    network_enabled: true,
    network: "Multiplayer",
    ete_enabled: false,
    airspeed_enabled: true,
    vertspeed_enabled: true,
    altitude_enabled: true,
    heading_enabled: true,
    distance_enabled: true,
    color_wrapper: "#00000060",
    color_outline: "#A0A0A0FF",
    color_background: "#20202080",
    color_text: "#FFFFFFFF"
};
ds_import(this.store);

// Take all config options and place them in a `settings` object
let settings = load_enabled(this.store, enabled_items, disabled_items);

settings.destination.changed = (value) => {
    this.store.destination = value;
    ds_export(this.store);
    target_airport = null;
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
    this.store.script_enabled = !this.store.script_enabled;
    ds_export(this.store);

    return true;
});

state(() => {
    return "mdi:airplane";
});

info(() => {
    return "Overlain'";
});

style(() => {
    return this.store.script_enabled ? "active" : null;
});

/* Otto search
search(["ol"], (query, callback) => {
    let results = [];
    callback(results);
});


script_message_rcv((ref_name, message, callback) => {
    console.log(`Message: ${message} from ${ref_name}`);
    callback(true);
});
*/

loop_1hz(() => {
    // Less important things loop at 1hz for performance
    load_views(enabled_items, disabled_items);

    if (this.store.distance_enabled) {
        let ac_lat = get("A:PLANE LATITUDE", "degrees");
        let ac_lon = get("A:PLANE LONGITUDE", "degrees");

        if (target_airport == null) {
            get_airport("luckayla-lookup", this.store.destination, (results) => {
                target_airport = results[0];
                ap_lat = target_airport.lat;
                ap_lon = target_airport.lon;
            });
        }

        distance = calc_distance(ac_lat, ac_lon, ap_lat, ap_lon);
    }

    let groundspeed = get("A:GROUND VELOCITY", "knots");

    // Simple ETE calculation
    let ete = distance / groundspeed;
    let date = new Date(0, 0);

    // This will not work for spans greater than 99h99m
    date.setSeconds(ete === Infinity ? 0 : ete * 60 * 60);
    ete_label.innerText = `ETE: ${date.toTimeString().slice(0, 5)}`;

    // Update the rest of the labels
    let airspeed = get("A:AIRSPEED INDICATED", "knots");
    let vertspeed = get("A:VERTICAL SPEED", "ft/min");
    let altitude = get("A:PLANE ALTITUDE", "feet");
    let heading = get("A:PLANE HEADING DEGREES MAGNETIC", "degrees");

    airspeed_label.innerText = `IAS: ${Math.round(airspeed)}kt`;
    vertspeed_label.innerText = `V/S: ${Math.round(vertspeed)}fpm`;
    altitude_label.innerText = `Alt: ${Math.round(altitude)}ft`;
    type_label.innerText = `${this.store.type}`;
    registration_label.innerText = `# ${this.store.registration}`;
    airline_label.innerText = `$ ${this.store.airline}`;
    origin_label.innerText = `From: ${this.store.origin}`;
    destination_label.innerText = `To: ${this.store.destination}`;
    distance_label.innerText = `DTG: ${Math.round(distance)}nm`;
    rules_label.innerText = `Rules: ${this.store.rules}`;
    network_label.innerText = `Net: ${this.store.network}`;
    heading_label.innerText = `HDG: ${Math.round(heading).toString().padStart(3, "0")}`;
});

html_created((el) => {
    // Get referneces to the overlay elements
    container = el.querySelector("#streamer_overlay");
    var_list = el.querySelector("#streamer_overlay_vars");
    type_label = el.querySelector("#streamer_overlay_type");
    registration_label = el.querySelector("#streamer_overlay_registration");
    airline_label = el.querySelector("#streamer_overlay_airline");
    origin_label = el.querySelector("#streamer_overlay_origin");
    destination_label = el.querySelector("#streamer_overlay_destination");
    distance_label = el.querySelector("#streamer_overlay_distance");
    rules_label = el.querySelector("#streamer_overlay_rules");
    network_label = el.querySelector("#streamer_overlay_network");
    ete_label = el.querySelector("#streamer_overlay_ete");
    airspeed_label = el.querySelector("#streamer_overlay_airspeed");
    vertspeed_label = el.querySelector("#streamer_overlay_vertspeed");
    altitude_label = el.querySelector("#streamer_overlay_altitude");
    heading_label = el.querySelector("#streamer_overlay_heading");

    set_colors(this.store);

    load_views(enabled_items, disabled_items);
});
