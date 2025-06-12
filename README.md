# excerpter
HTML excerpt generator from ELAN files as used on [diksioinariu.com](https://diksionariu.com)

Based on other projects:
- [WebELAN](https://github.com/drdrphd/WebELAN)
- [transcripter](https://github.com/drdrphd/transcripter)

Generates HTML excerpts of ELAN's .eaf files (XML based time-aligned multi-tier transcripts; software from Max-Planck, a standard format in linguistics)

Somewhat slow due to current libraries.

Links on morphemes are in a wikipedia-style markup [[link]], which is used internally by diksionariu.com

# Use
You must have an ELAN file with annotated content. It should be exported WITH any time offsets. (I think... I've added an offset in the script, but better to be safe)

To properly tag the tiers, currently tiers should be of the types:
```
<LINGUISTIC_TYPE LINGUISTIC_TYPE_ID="Sentences" TIME_ALIGNABLE="true"/>
<LINGUISTIC_TYPE CONSTRAINTS="Time_Subdivision" LINGUISTIC_TYPE_ID="Words" TIME_ALIGNABLE="true"/>
<LINGUISTIC_TYPE CONSTRAINTS="Symbolic_Subdivision" LINGUISTIC_TYPE_ID="Morphemes" TIME_ALIGNABLE="false"/>
<LINGUISTIC_TYPE CONSTRAINTS="Symbolic_Association" LINGUISTIC_TYPE_ID="Gloss" TIME_ALIGNABLE="false"/>
<LINGUISTIC_TYPE CONSTRAINTS="Symbolic_Association" LINGUISTIC_TYPE_ID="Translation" TIME_ALIGNABLE="false"/>
<LINGUISTIC_TYPE LINGUISTIC_TYPE_ID="Metadata" TIME_ALIGNABLE="true"/>
```
Next step is to make tiers selectable for type, or to generate a CSS file that works with the tiers in the dropped-in transcripts.

.mp3 files, when used with WebAudio, MUST be of CONSTANT bitrate. You cannot use VBR and expect timings to match up on current browsers.
