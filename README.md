# Flight Overlay

This one is simple, displays flight information as a bar in realtime.
Intended for use by livestreamers.

Note: Display with all options enabled will not display correctly on screen resolutions below 1080p. This is a conscious design decision to compromise between readability, and I firmly believe that VERY few people are running MSFS on screens lower than 1080p.

Note 2: Simbrief integration is currently NOT IMPLEMENTED! The option box will do nothing until a future update.

Note 3: It is normal to see the occasional TypeError in the console log, this happens during refresh of the overlay occasionally due to variable checks happening before they have been completely reloaded.
This will NOT affect performance and as I find them, I'm working to patch them out.

## Installation

Simply copy the HTML/CSS/JS into a new script on Flow, and configure the settings in the panel.

I will provide a community-folder installable package at a later time once I'm happy
with the state of the script. (Coming soon!)

Also with the next update will include re-added SimBrief support and some bugfixes.

## Example

![example](https://cdn.wolfie.space/images/FlightSimulator_1676447874.png)
