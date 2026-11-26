# FOLIO — Problems and fixes

| Problem found | How it was fixed |
| --- | --- |
| `.gitignore` did not cover environment-file variants, generated exports or shelf backups. | Added `.env.*`, `!.env.example`, `/data/`, `/output/` and `folio-shelf*.json`. Checked the ignore rules in a temporary Git repository. |
| Setup instructions still described deployment as a future step and used a different local address from the README. | Updated the instructions for the existing Pages workflow and consistently used `127.0.0.1`, avoiding confusion between separate browser-storage origins. |
| Verification notes did not include the later user-confirmed browser and deployment checks. | Added the observed results while retaining a separate record of checks still pending. |
| Attribution wording did not acknowledge book-cover artwork visible in the documentation screenshots. | Clarified that screenshots reproduce source cover artwork and do not transfer ownership. |
