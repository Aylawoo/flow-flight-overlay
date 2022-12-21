let get = this.$api.variables.get;

let container = null;

let airframe = null;
let registration = null;
let origin = null;
let destination = null;
let airline = null;

// TODO: Input network for vatsim/pe/etc

// TODO: Plane input

// TODO: Config colors

// TODO: Config simbrief username

run((event) => {
    on_click = {
        from: "wheel"
    }

    let req = new XMLHttpRequest();
    req.open(
        "GET",
        "https://www.simbrief.com/api/xml.fetcher.php?username={username}&json=1"
        );
        req.responseType = "json";
        req.send();
        req.onload = () => {
            let data = req.response;

            airframe = data.aircraft.icaocode;
            this.frame_label.innerText = `Type: ${airframe}`;
            registration = data.aircraft.reg;
            this.reg_label.innerText = registration;
            origin = data.api_params.orig;
            this.origin_label.innerText = `DEP: ${origin}`;
            destination = data.api_params.dest.toUpperCase();
            this.dest_label.innerText = `ARR: ${destination}`;
            airline = data.api_params.airline;
            this.airline_label.innerText = `Airline: ${airline}`;
        }

    return false;
});

loop_15hz(() => {
    let airspeed = get("A:AIRSPEED INDICATED", "number") * 1.944;
    let groundspeed = get("A:GROUND VELOCITY", "number") * 1.944;
    let vs = get("A:VERTICAL SPEED", "number") * 200;
    let altitude = get("A:PLANE ALTITUDE", "number") * 3.281;
    let heading = get("A:PLANE HEADING DEGREES MAGNETIC", "number") * (180/Math.PI);

    this.as_label.innerText = `IAS: ${Math.round(airspeed)} kts`;
    this.gs_label.innerText = `G/S: ${Math.round(groundspeed)} kts`;
    this.vs_label.innerText = `V/S: ${Math.round(vs)} fpm`
    this.alt_label.innerText = `ALT: ${Math.round(altitude)} ft`;
    this.hdg_label.innerText = `HDG: ${Math.round(heading)}`;
});

html_created((el) => {
    this.container = el.querySelector("#luckayla_overlay");
    this.as_label = el.querySelector("#airspeed");
    this.gs_label = el.querySelector("#groundspeed");
    this.vs_label = el.querySelector("#vs");
    this.alt_label = el.querySelector("#altitude");
    this.hdg_label = el.querySelector("#heading");
    this.frame_label = el.querySelector("#airframe");
    this.reg_label = el.querySelector("#registration");
    this.origin_label = el.querySelector("#origin");
    this.dest_label = el.querySelector("#destination");
    this.airline_label = el.querySelector("#airline");
});
