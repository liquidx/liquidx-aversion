aversion.one codebase

This project is for hosting vibe-coded prototypes.
Each prototype is linked from the front page and then self contained within a Svelte component in src/lib/components/Aversion[name].svelte.

# Prototypes

## Code Poet

Exploring the idea of how poetry could be generated from code. And then the possiblity of poetry be used to prompt LLMs to generate code. What would a poem look like that was generated with code and how would different styles of poetry affect the type of code that could be generated?

## Metro

Metro is a subway map editor where you can add stations and create train lines.

The app works in several modes.

- In Line mode, click to drop stations on the map. Click on the station to select it, once selected the station can be moved around, renamed, color can be changed and the position of the label can be edited.

- In Station mode, click on multiple stations to select. Use the link stations button to create a new line. Selecting a line itself will allow changing the color and other attributes of the line

## Navigator

Imagine if there was a browser for an LLM. That is, we type in URLs, give it to the LLM to generate web pages like the internet seems to conjure up content. Inspect the LLM through HTML that it generates. What would it imagine a non-existent website be of, what does it remember of past websites that do not exist any more. What about the twitter account of someone from the 1600s?

We make a fake browser in the style of the old Mosaic & Netscape era.

## Multiplayer

A prototype that explores an idea where the user can chat with multiple AIs at the same time. Inspired by [a post about Multiplayer from Matt Webb](https://interconnected.org/home/2025/05/23/turntaking) about how to know who's turn it is to speak. This prototype tries to test whether an LLM could potentially figure out who would likely go next, and even when the conversation can die down.

The prompt that's used can be modified to explore different behaviors, but the one that is live in the prototype does a pretty good job to mix up who is speaking, stop at the right place and also prevent the chat from going off course.
