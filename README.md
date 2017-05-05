Ticket Merger
===============

This app displays tickets from the same requester at the ticket currently being viewed, and allows you to merge them into the current ticket or into a target ticket.
It also will display a modal when the user tries to update the ticket if both of the following are true:
* there are tickets available to merge
* the user has not merged any of the tickets since the app was loaded

The app displays a list of tickets from the same requester. Each item has the following information:

* ticket subject
* comments
* timestamps
* comment authors

![screenshot](/assets/screenshot-0.png?raw=true "screenshot")

![screenshot](/assets/screenshot-1.png?raw=true "screenshot")

![screenshot](/assets/screenshot-2.png?raw=true "screenshot")

## Installation

Just install it, really.

Ok, you'll need to zip the files up and install it as a private app in Zendesk. Zendesk App Tools is recommended for zipping the project. Once you have that installed, do this (from within the app's directory):
```
$ zat package
```

That will create a `.zip` file in `/tmp`. Upload that file to Zendesk using [these instructions](https://help.zendesk.com/hc/en-us/articles/229489328-Uploading-and-installing-your-private-app-in-Zendesk-Support).

## Contributing

Do it. Fork the repo, make some meaningful changes, and submit a Pull Request. 👌
