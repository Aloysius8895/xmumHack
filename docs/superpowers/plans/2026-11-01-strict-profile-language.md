# Strict profile language selection

**Problem:** An extracted NLP skill has no catalog ID, so the frontend renders its original Chinese name even while displaying translated English evidence. Ordinary mutation responses can also overwrite the current view after a language change.

**Design:** Resolve skill-name aliases against the multilingual catalog without changing IDs or scores. Store unknown extracted names in all three languages, repair legacy unknown names with the existing translation service, and retain translations through profile edits. Never display untranslated Han-script skill labels in English/Malay: show a translated pending label if no usable translation exists. Ignore API state responses from a superseded language and reload in the current selection.

**Verification:** Regression coverage for null-ID NLP aliases, unknown-name translation/cache, translation rejection and profile-edit preservation, frontend language selection and out-of-order request responses. Run profile/posting/roadmap localization tests and production build.
