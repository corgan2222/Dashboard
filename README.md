
# Awesome IT Dashboard 

[![Angular Logo](https://www.vectorlogo.zone/logos/angular/angular-icon.svg)](https://angular.io/) [![Electron Logo](https://www.vectorlogo.zone/logos/electronjs/electronjs-icon.svg)](https://electronjs.org/)

![](https://raw.githubusercontent.com/corgan2222/Dashboard/master/doc/it_dash_3.jpg)

# Features

- 6 Panels
- configure each panel seperate 
- configure panel size with slider
- display any website in the panels
- hide the panels if not needed with a button click
- links open in system default browser
- load custom css
- darkmode
- electron app should run fine on windows/linux/mac

# Download

- Download latest Windows binary https://github.com/corgan2222/Dashboard/releases

# Dependencies for building from source

- Node 12+ 
- Visual Studio

# Getting started compiling

Clone this repository locally :

``` bash
git clone https://github.com/corgan2222/Dashboard
```

Install dependencies with npm :

``` bash
npm install
```

run :

``` bash
Npm run start
```

## Included Commands

|Command|Description|
|--|--|
|`npm run ng:serve:web`| Execute the app in the browser |
|`npm run build`| Build the app. Your built files are in the /dist folder. |
|`npm run build:prod`| Build the app with Angular aot. Your built files are in the /dist folder. |
|`npm run electron:local`| Builds your application and start electron
|`npm run electron:linux`| Builds your application and creates an app consumable on linux system |
|`npm run electron:windows`| On a Windows OS, builds your application and creates an app consumable in windows 32/64 bit systems |
|`npm run electron:mac`|  On a MAC OS, builds your application and generates a `.app` file of your application that can be run on Mac |

** Your application is optimised. Only /dist folder and node dependencies are included in the executable.

# Bugs and Todo

- Show Icons even for non https links. ATM, if a link for a frame is not https, the icon is not shown
- Show Toogle Icons for each Frame to toogle

### Changes to frames:
- allow loading no http content into https sites ( --disable-web-security --allow-running-insecure-content )
- show content in fullframe (camera stream image) - i can provide css/html for that
- reload a frame after time (from settings), like if hiding and showing frame content
need this, because of massive ram increase after time on the grafana frame
- Frame Settings for each frame for the changes above:
- fix the settings window, atm its breaks if two entrys has the same url/name
- Checkbox to allow loading http content into https
- Checkbox to show frame content fullframe
- Refresh frame each XX minutes to prevent buffer overflow or similare technic

# looking for help on

because of mylimited time, im looking for developers to work with my on this project

# Build with

- Angular 
- Electron 
- Electron Builder 

![](https://raw.githubusercontent.com/corgan2222/Dashboard/master/doc/it_dash_1.jpg)


# Meta

Stefan Knaak – stefan@knaak.org, daniotech7
