// ---- To-do list
// TODO: Config colors
// TODO: Change settings via Otto
// TODO: Simbrief integration
// TODO: Distance/ETE calculation
// TODO: Messages from Twitch Bot plugin

// ---- API function shorthands
let get = this.$api.variables.get,
    get_server = this.$api.community.get_server,
    get_metar = this.$api.weather.find_metar_by_icao;

let ds_export = this.$api.datastore.export,
    ds_import = this.$api.datastore.import;

let twitch_send = this.$api.twitch.send_message,
    twitch_connected = this.$api.twitch.is_connected;

// ---- Helper functions
function define_option(storage, setting_name, input_type, ui_label) {
    return {
        type: input_type,
        label: ui_label,
        value: storage[setting_name],

        changed: (value) => {
            storage[setting_name] = value;
            ds_export(storage);
        }
    };
}

// ---- Script variables
const VERSION = "0.1.0";

const BOX = "checkbox",
      TXT = "text";

let container = null,
    var_list = null,
    type_label = null,
    registration_label = null,
    airline_label = null,
    origin_label = null,
    destination_label = null,
    rules_label = null,
    network_label = null,
    ete_label = null,
    airspeed_label = null,
    vertspeed_label = null,
    altitude_label = null,
    heading_label = null;

let enabled_items = [],
    disabled_items = [];

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
    heading_enabled: true
}
ds_import(this.store);

let non_visual = ["script_enabled", "simbrief_enabled"];

// Take all config options and place them in a `settings` object
let settings = {}
for (let item in this.store) {
    let enable_switch = typeof this.store[item] === "boolean";
    let name = item.split("_").join(" ").toUpperCase();

    settings[item] = define_option(this.store, item, enable_switch ? BOX: TXT, name);

    // Skip non-display items and setting values
    if (!enable_switch || non_visual.includes(item)) {
        continue;
    }

    // Add values to the enabled/disabled lists
    let item_name = item.split("_")[0];

    if (this.store[item] == true) {
        enabled_items.push(item_name);
    } else {
        disabled_items.push(item_name);
    }
}

/* Template for adding to settings changed value
settings.simbrief_enabled.changed = (value) => {
     console.log(value);
}
*/

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

loop_15hz(() => {
    let ete = "Eventually";
    let airspeed = get("A:AIRSPEED INDICATED", "knots");
    let vs = get("A:VERTICAL SPEED", "ft/min");
    let altitude = get("A:PLANE ALTITUDE", "feet");
    let heading = get("A:PLANE HEADING DEGREES MAGNETIC", "degrees");

    /* HACK:
    For some reason, without setTimeout() at any higher than loop_1hz() this
    code produces a single, consistently reproducible error in the log, saying that
    the very first label in the list is null, however it still displays correctly
    as if the error had not happened. I decided to add a delay, and it worked. I reduced
    the delay all the way down to 1ms and it STILL works without an error. So this
    is staying here for the time being. I'll poke //42 about it but I assume it's a
    processing speed limitation of the JavaScript engine MSFS forces us to use.
    */
    setTimeout(() => {
        type_label.innerText = `Type: ${this.store.type}`;
        registration_label.innerText = `Reg: ${this.store.registration}`;
        airline_label.innerText = `Airline: ${this.store.airline}`;
        origin_label.innerText = `Orig: ${this.store.origin}`;
        destination_label.innerText = `Dest: ${this.store.destination}`;
        rules_label.innerText = `Rules: ${this.store.rules}`;
        network_label.innerText = `Network: ${this.store.network}`;
        ete_label.innerText = `ETE: ${ete}`;
        airspeed_label.innerText = `IAS: ${Math.round(airspeed)}kt`;
        vertspeed_label.innerText = `V/S: ${Math.round(vs)}f/m`;
        altitude_label.innerText = `ALT: ${Math.round(altitude)}ft`;
        heading_label.innerText = `HDG: ${Math.round(heading)}`;
    }, 1);
});

html_created((el) => {
    container = el.querySelector("#luckayla_overlay");
    var_list = el.querySelector("#vars");
    type_label = el.querySelector("#type");
    registration_label = el.querySelector("#registration");
    airline_label = el.querySelector("#airline");
    origin_label = el.querySelector("#origin");
    destination_label = el.querySelector("#destination");
    rules_label = el.querySelector("#rules");
    network_label = el.querySelector("#network");
    ete_label = el.querySelector("#ete");
    airspeed_label = el.querySelector("#airspeed");
    vertspeed_label = el.querySelector("#vertspeed");
    altitude_label = el.querySelector("#altitude");
    heading_label = el.querySelector("#heading");

    for (let index in disabled_items) {
        let id = `#${disabled_items[index]}`;
        let elem = el.querySelector(id);

        elem.style.display = "none";
    }

    for (let index in enabled_items) {
        let id = `#${enabled_items[index]}`;
        let elem = el.querySelector(id);

        elem.style.display = "inline-flex";
    }
});

exit(() => {
    console.log("Overlay shutting down...")
});
