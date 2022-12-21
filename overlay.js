let container = null;
let get = this.$api.variables.get;

// TODO: Fetch simbrief OFP
// - ETE
// - Distance
// - REG/Callsign

// TODO: Input network for vatsim/pe/etc

// TODO: Plane input

loop_15hz(() => {
    let groundspeed = get("A:GROUND VELOCITY", "number") * 1.944;

    this.as_label.innerText = `Indicated: ${Math.round(airspeed)} kts`;
    this.gs_label.innerText = `Ground: ${Math.round(groundspeed)} kts`;
    this.vs_label.innerText = `V/S: ${Math.round(vs)} fpm`
    this.alt_label.innerText = `Altitude: ${Math.round(altitude)} ft`;
    this.hdg_label.innerText = `Heading: ${Math.round(heading)}`;
});

html_created((el) => {
    this.container = el.querySelector("#luckayla_overlay");
    this.as_label = el.querySelector("#airspeed");
    this.gs_label = el.querySelector("#groundspeed");
    this.vs_label = el.querySelector("#vs");
    this.alt_label = el.querySelector("#altitude");
    this.hdg_label = el.querySelector("#heading");
});
