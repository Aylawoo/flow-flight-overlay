# Flight Overlay

This one is simple, displays flight information as a bar in realtime.
Intended for use by livestreamers.

Note: Display with all options enabled may not display correctly on screen resolutions below 1080p. This is a conscious design decision to compromise between readability, and I firmly believe that VERY few people are running MSFS on screens lower than 1080p.

## Features
- Toggle overlay by clicking wheel or in widget settings
- Overlay at top or bottom of screen
- Overlay flight information
  - Aircraft type
  - Aircraft registration
  - Airline
  - Origin airport
  - Destination airport
  - Distance from current position to selected destination airport
  - ETE (Calculation WIP)
  - Flight rules
  - Multiplayer network
  - Current indicated airspeed
  - Current vertical speed
  - Current altitude
  - Current heading
  - Wind direction/speed
    - Arrow will rotate to show relative wind direction
  - Outside air temperature
    - Icon changes when below freezing or above 37c/98.6f
    - Toggle between Fahrenheit/Celsius separate to "USE METRIC" setting
  - Pad numbers with leading 0s to avoid overlay changing size
- Custom style
  - Imperial or metric units
  - Customizable UI scale
    - From wheel options menu OR by scrolling up/down while hovering over the bar
    - Size unit is pixels
    - Limited to 8px minimum, 128px maximum
  - Toggleable text outline
  - Text color
  - Background color
  - Item background color
  - Item outline color
  - Supports all HTML color formats (#000000, color name, rgb(), rgba(), etc)
  - Icons or text for info labels
    - V/S icon will change between flat, up, and down arrows
    - Toggle between white or black icons
- Import data from SimBrief
  - Import by setting SimBrief username and SIMBRIEF ENABLED in settings
  - Download by scrolling up or down over the widget on the wheel
    - Limited to once per 20s to avoid excess requests. Subject to change
  - Aircraft type
  - Aircraft registration
  - Origin airport
  - Destination airport
  - Airline / callsign

## Installation

### Latest "Released" version
Visit [The releases page](https://github.com/AylaCodes/flow-flight-overlay/releases/) and download/install the latest Release

### Latest "Dev" version
Simply copy the HTML/CSS/JS into a new script on Flow, and configure the settings in the panel.

## Example

![example](https://cdn.wolfie.space/images/FlightSimulator_1677622577.png)
