# TYPO3 Google Font Extension

## Description
This TYPO3 extension includes Google Font in your TYPO3 website.

Unlike regular TypoScript adding, this extension adds Google Font in an asynchronous, non-blocking way.
It also performs a preconnect for maximum loading efficiency

## Installation

Add the extension to your project using Composer:
```sh
composer require marekskopal/typo3-google-font
```


## Configuration

1. Add the static template to your TypoScript template:
    - Go to **WEB** > **Template** module.
    - Select your root page.
    - Click on **Info/Modify**.
    - Click on **Edit the whole template record**.
    - Go to the **Includes** tab.
    - Add **Google Font** from the **Available Items** to the **Selected Items**.

2. Add you Google Font to the TypoScript configuration:
```
plugin.tx_msgooglefont {
    settings {
        fontSrc {
            1 = https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap
        }
    }
}

```
