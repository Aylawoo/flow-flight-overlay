let container = null;
let get = this.$api.variables.get;

// TODO: Fetch simbrief OFP
// - ETE
// - Distance
// - REG/Callsign

// TODO: Input network for vatsim/pe/etc

// TODO: Plane input

loop_15hz(() => {
    let airspeed = get("AIRSPEED INDICATED", "number");
    let vs = get("VERTICAL SPEED", "number") * 60;
    let altitude = get("PLANE ALTITUDE", "number");
    let heading = get("PLANE HEADING DEGREES MAGNETIC", "number") * (180/Math.PI);

    this.as_label.innerText = `Airspeed: ${Math.round(airspeed)} kts`;
    this.vs_label.innerText = `V/S: ${Math.round(vs)} fpm`
    this.alt_label.innerText = `Altitude: ${Math.round(altitude)} ft`;
    this.hdg_label.innerText = `Heading: ${Math.round(heading)}`;
});

exit(() => {

});

html_created((el) => {
    this.container = el.querySelector("#luckayla_overlay");
    this.as_label = el.querySelector("#airspeed");
    this.vs_label = el.querySelector("#vs");
    this.alt_label = el.querySelector("#altitude");
    this.hdg_label = el.querySelector("#heading");
});
