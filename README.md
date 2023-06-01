# Streamer Overlay
## A customizable flight information overlay for streamers
---

Note: Display with all many, or all options enabled may not display correctly on some screen resolutions at the default scale, this is not a bug. Simply scale the interface down (Via settings menu or mouse scroll over the bar) to adjust it appropriately.

## Features
- Toggle overlay by clicking wheel or in widget settings
- Automatic built-in day/night themes, or a set theme customizable by the user
- Overlay at top or bottom of screen
- Load some flight information from SimBrief (Noted below)
  - Import by setting SimBrief username and SIMBRIEF ENABLED in settings
  - Download by scrolling up or down over the widget on the wheel
    - Limited to once per 20s to avoid excess requests. Subject to change
- Toggle between Imperial and Metric units
- Overlay flight information
  - Custom text field
    - Option to change icon (if icons enabled) to any provided mdi-icon
  - Aircraft type
    - Loaded from SimBrief (When enabled)
  - Aircraft registration
    - Loaded from SimBrief (When enabled)
  - Airline
    - Loaded from SimBrief (When enabled)
  - Departure airport
    - Loaded from SimBrief (When enabled)
  - Distance from current position to selected destination airport
  - Destination airport
    - Loaded from SimBrief (When enabled)
  - Flight rules
    - Click on the overlay to toggle between VFR/IFR/SVFR
  - Multiplayer network
  - Current indicated airspeed
  - Current vertical speed
    - Icon changes between up/down/horizontal bar depending on vertical speed
  - Current altitude
  - Current heading
  - Wind direction/speed
    - Arrow will rotate to show wind direction relative to aircraft
  - Outside air temperature
    - Icon changes when below freezing or above 37c/98.6f
    - Toggle between Fahrenheit/Celsius separate to "USE METRIC" setting
  - Pad numbers with to avoid overlay changing size
    - Option on whether or not to display leading zeroes
- Custom style
  - Customizable UI scale
    - From wheel options menu OR by scrolling up/down while hovering over the bar
    - Size unit is em
    - Limited to 0.85 minimum and 6 maximum em
  - Icons for each displayed item
    - Toggleable, text labels will be used if disabled
    - Dark mode option
  - Toggleable Flow logo
  - Toggleable text outline
    - Customizable color
  - Overlay background color
  - Item outline color
  - Item background color
  - Text color
  - Supports all HTML color formats (#000000, color name, rgb(), rgba(), etc)

## Installation

### Latest "Released" version
Visit [The releases page](https://github.com/AylaCodes/flow-flight-overlay/releases/) and download/install the latest Release.

### Latest "Dev" version
Simply copy the HTML/CSS/JS into a new script on Flow, and configure the settings in the panel.

## Example

![example](https://cdn.wolfie.space/images/FlightSimulator_1685577767.png)
