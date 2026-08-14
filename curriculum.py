CHAPTERS = {
    1: {
        "name": "Reisen und Mobilität",
        "topics": ["Verkehrsmittel", "Reiseerlebnisse", "Stadtplanung", "Orientierung"],
        "key_vocab": ["die Reise", "der Bahnhof", "das Flugzeug", "umsteigen", "ankommen",
                      "die Verspätung", "der Fahrplan", "reservieren", "die Unterkunft"],
        "grammar_focus": "Konjunktiv II – Wünsche und Möglichkeiten",
    },
    2: {
        "name": "Gesundheit und Körper",
        "topics": ["Gesundheitsvorsorge", "Ernährung", "Sport", "Arztbesuch"],
        "key_vocab": ["die Gesundheit", "das Rezept", "die Apotheke", "sich erholen",
                      "behandeln", "die Beschwerde", "der Schmerz", "sich impfen lassen"],
        "grammar_focus": "Passiv (Präsens, Präteritum, Perfekt)",
    },
    3: {
        "name": "Medien und Kommunikation",
        "topics": ["Soziale Medien", "Nachrichten", "Digitalisierung", "Werbung"],
        "key_vocab": ["die Nachricht", "veröffentlichen", "teilen", "der Einfluss",
                      "berichten", "das Netzwerk", "hochladen", "der Kommentar"],
        "grammar_focus": "Relativsätze (Nominativ, Akkusativ, Dativ)",
    },
    4: {
        "name": "Arbeit und Beruf",
        "topics": ["Bewerbung", "Arbeitsalltag", "Berufswahl", "Homeoffice"],
        "key_vocab": ["die Bewerbung", "das Vorstellungsgespräch", "der Lebenslauf",
                      "kündigen", "einstellen", "die Gehaltsverhandlung", "die Stelle"],
        "grammar_focus": "Kausale und konzessive Nebensätze (weil, obwohl, da, trotzdem)",
    },
    5: {
        "name": "Umwelt und Natur",
        "topics": ["Klimawandel", "Nachhaltigkeit", "Naturschutz", "Energie"],
        "key_vocab": ["der Klimawandel", "nachhaltig", "recyceln", "der Naturschutz",
                      "umweltfreundlich", "die Emissionen", "erneuerbar", "schützen"],
        "grammar_focus": "Finalsätze und Konsekutivsätze (damit, sodass, um…zu)",
    },
    6: {
        "name": "Gesellschaft und Zukunft",
        "topics": ["Generationen", "Technologie", "Globalisierung", "Integration"],
        "key_vocab": ["die Gesellschaft", "die Generation", "verändern", "global",
                      "die Zukunft", "die Integration", "vielfältig", "der Fortschritt"],
        "grammar_focus": "Partizipien als Adjektive und Nominalstil",
    },
}

GRAMMAR_CATEGORIES = {
    "Konjunktiv II": {
        "description": "Wünsche, Möglichkeiten, höfliche Bitten",
        "examples": ["Ich würde gerne...", "Könnten Sie...?", "Wenn ich Zeit hätte,..."],
        "difficulty": "B1-B2",
        "common_forms": ["würde", "wäre", "hätte", "könnte", "sollte", "müsste", "dürfte"],
    },
    "Passiv": {
        "description": "Passiv Präsens, Präteritum und Perfekt",
        "examples": ["Das Haus wird gebaut.", "Das Buch wurde geschrieben.",
                     "Das Formular ist ausgefüllt worden."],
        "difficulty": "B1",
        "common_forms": ["wird/werden + Partizip II", "wurde/wurden + Partizip II",
                         "ist/sind + Partizip II + worden"],
    },
    "Relativsätze": {
        "description": "Relativpronomen in allen Kasus",
        "examples": ["Der Mann, der...", "Das Buch, das...", "Die Frau, der ich...",
                     "Das Kind, dem ich...", "Das Haus, dessen Garten..."],
        "difficulty": "B1",
    },
    "Adjektivdeklination": {
        "description": "Adjektive mit bestimmtem, unbestimmtem Artikel und ohne Artikel",
        "examples": ["der alte Mann", "ein alter Mann", "alter Mann",
                     "die schöne Frau", "eine schöne Frau"],
        "difficulty": "B1",
    },
    "Trennbare Verben": {
        "description": "Trennbare und untrennbare Verben korrekt verwenden",
        "examples": ["ankommen → Ich komme an.", "aufstehen → Er steht auf.",
                     "verstehen → Ich verstehe.", "vorstellen → Stell dich vor!"],
        "difficulty": "B1",
    },
    "Präpositionen": {
        "description": "Wechselpräpositionen (Dativ/Akkusativ) und feste Verbpräpositionen",
        "examples": ["Ich sitze auf dem Stuhl. / Ich setze mich auf den Stuhl.",
                     "denken an + Akk.", "warten auf + Akk.", "sich freuen über + Akk."],
        "difficulty": "B1-B2",
    },
    "Perfekt vs. Präteritum": {
        "description": "Gesprochenes (Perfekt) vs. Geschriebenes (Präteritum) Deutsch",
        "examples": ["Ich habe gegessen. (gesprochen)", "Ich aß. (geschrieben)",
                     "Er ist gegangen. / Er ging."],
        "difficulty": "B1",
    },
    "Nebensätze": {
        "description": "Kausale, konzessive, finale und temporale Nebensätze",
        "examples": ["weil/da (kausal)", "obwohl/obgleich (konzessiv)",
                     "damit/um…zu (final)", "als/wenn/nachdem (temporal)"],
        "difficulty": "B1-B2",
    },
    "Nominalstil": {
        "description": "Verben in Nomen umwandeln (Schriftsprache B2)",
        "examples": ["Die Entscheidung wurde getroffen.",
                     "Nach der Ankunft...", "Aufgrund der Verspätung..."],
        "difficulty": "B2",
    },
}

CHAPTER_GRAMMAR_MAP = {
    1: "Konjunktiv II",
    2: "Passiv",
    3: "Relativsätze",
    4: "Nebensätze",
    5: "Nebensätze",
    6: "Nominalstil",
}

GRAMMAR_EXPLANATIONS = {
    "Konjunktiv II": {
        "title": "Konjunktiv II – Feltételes mód",
        "content": """
### Mikor használjuk?
1. **Feltételes mondatok** (ha… akkor…): *Wenn ich Zeit hätte, würde ich üben.*
2. **Udvarias kérések**: *Könnten Sie mir helfen? / Ich hätte gerne einen Kaffee.*
3. **Irreális kívánságok**: *Ich wäre so gerne in Berlin!*

---

### Képzés

**Általános szabály**: `würde` + főnévi igenév
> *Ich würde gerne reisen. / Er würde das nicht machen.*

**Rendhagyó alakok – ezeket fejből kell tudni!**

| Ige | Konjunktiv II | Magyar |
|-----|--------------|--------|
| sein | wäre | lenne |
| haben | hätte | lenne neki |
| können | könnte | tudna |
| müssen | müsste | kellene |
| dürfen | dürfte | szabad lenne |
| sollen | sollte | kellene (külső elvárás) |
| wollen | wollte | akarna |
| werden | würde | (segédige) |

**Ragozás** (pl. `wäre`):
ich wäre · du wär(e)st · er/sie/es wäre · wir wären · ihr wär(e)t · sie/Sie wären

---

### Feltételes mondatok (wenn … dann …)

Mindkét tagmondatban Konjunktiv II kell:

> *Wenn ich mehr Geld **hätte**, **würde** ich eine Reise machen.*
> *Wenn er fleißiger **wäre**, **könnte** er die Prüfung bestehen.*

⚠️ **Ökölszabály**: `würde` + infinitív helyett a rendhagyó alakot használd!
- ❌ *Wenn ich würde haben* → ✅ *Wenn ich **hätte***
- ❌ *Wenn er würde sein* → ✅ *Wenn er **wäre***

---

### Leggyakoribb fordulatok
| Német | Magyar |
|-------|--------|
| Das wäre sehr nett. | Ez nagyon kedves lenne. |
| Könntest du mir helfen? | Tudnál segíteni? |
| Ich würde gerne... | Szívesen... |
| An deiner Stelle würde ich... | A te helyedben... |
| Es wäre besser, wenn... | Jobb lenne, ha... |
""",
        "tip": "💡 Ha bizonytalan vagy, a `würde` + infinitív mindig biztonságos, de a haben/sein/können rendhagyó alakjait célszerű fejből tudni.",
    },

    "Passiv": {
        "title": "Passiv – Szenvedő szerkezet",
        "content": """
### Mikor használjuk?
- Ha a cselekvő nem ismert vagy nem fontos: *Das Fenster wurde geöffnet.*
- Ha a cselekvésen van a hangsúly, nem a cselekvőn: *Die Stadt wird renoviert.*
- Hivatalos és tudományos szövegekben nagyon gyakori!

---

### A három fő Passiv idő

**1. Passiv Präsens** → `werden` (jelen) + Partizip II
> *Das Haus **wird** gebaut.* (éppen épül)
> *Die Autos **werden** repariert.*

**2. Passiv Präteritum** → `wurden` + Partizip II  *(írott nyelv)*
> *Das Buch **wurde** 1900 geschrieben.*
> *Die Gesetze **wurden** geändert.*

**3. Passiv Perfekt** → `sein` (jelen) + Partizip II + `worden`
> *Das Haus **ist** renoviert **worden**.*
> *Der Brief **ist** abgeschickt **worden**.*

⚠️ **Figyelem**: Perfekt Passivban `worden`, NEM `geworden`!

---

### Cselekvő megnevezése: `von` + Dativ
> *Das Buch wurde **vom Autor** geschrieben.*
> *Die Stadt wird **von den Arbeitern** renoviert.*

---

### Vorgangspassiv vs. Zustandspassiv

| | Szerkezet | Jelentés |
|-|-----------|---------|
| Vorgangspassiv | `werden` + Partizip II | folyamat: éppen csinálják |
| Zustandspassiv | `sein` + Partizip II | állapot: már kész/be van zárva |

> *Das Geschäft **wird** geschlossen.* (most zárják be)
> *Das Geschäft **ist** geschlossen.* (be van zárva – állapot)

---

### Aktív → Passív átalakítás
| Aktív | Passív |
|-------|--------|
| Der Arzt behandelt den Patienten. | Der Patient wird **vom Arzt** behandelt. |
| Man hat das Fenster geöffnet. | Das Fenster ist geöffnet worden. |
""",
        "tip": "💡 Ha az aktív mondat alanya `man` (általános alany), a passzívban von + … el is maradhat.",
    },

    "Relativsätze": {
        "title": "Relativsätze – Vonatkozó mellékmondatok",
        "content": """
### Mi az a vonatkozó mellékmondat?
Egy főnevet pontosít vagy körülír: *Das ist der Mann, **der** gestern hier war.*
A vonatkozó névmás (der/die/das/dem/den/dessen…) a főnév nemét és esetét követi.

---

### Vonatkozó névmások táblázata

| | Nominativ | Akkusativ | Dativ | Genitiv |
|-|-----------|-----------|-------|---------|
| **der** (hímnem) | der | den | dem | dessen |
| **die** (nőnem) | die | die | der | deren |
| **das** (semleges) | das | das | dem | dessen |
| **die** (többes) | die | die | denen | deren |

---

### Szórend
A vonatkozó mellékmondat végén az **ige áll**:
> *Der Mann, der **hier wohnt**, ist mein Freund.*
> *Das Buch, das ich **gelesen habe**, war interessant.*

---

### Esetek meghatározása

**Nominativ** – a vonatkozó névmás a mellékmondat alanya:
> *Die Frau, **die** hier arbeitet, ist meine Kollegin.*

**Akkusativ** – a mellékmondat tárgya:
> *Der Film, **den** ich gesehen habe, war toll.*

**Dativ** – a mellékmondat részeshatározója:
> *Der Freund, **dem** ich geholfen habe, ist dankbar.*

**Genitiv** – „akinek/amelynek a…":
> *Das Haus, **dessen** Garten groß ist, gehört mir.*

---

### Elöljárószóval (Präposition + Relativpronomen)

Az elöljáró **a vonatkozó névmás előtt** áll:
> *Das ist die Stadt, **in der** ich geboren bin.*
> *Der Kollege, **mit dem** ich arbeite, ist sehr nett.*
> *Das Thema, **über das** wir sprechen, ist wichtig.*
""",
        "tip": "💡 Trükk az eset meghatározásához: képzeld el, hogy a főmondat folytatódik – milyen esetbe kerülne a szó ott? Pl. *Ich sehe den Mann* → Akkusativ → `den`.",
    },

    "Adjektivdeklination": {
        "title": "Adjektivdeklination – Melléknévragozás",
        "content": """
### A három ragozási eset

A melléknév végződése attól függ, hogy **van-e előtte névelő**, és ha igen, milyen.

---

### 1. Határozott névelővel (der/die/das)
→ A névelő már mutatja az esetet, a melléknév „gyenge" végződést kap (-e, -en)

| | Mask. | Fem. | Neutr. | Plur. |
|-|-------|------|--------|-------|
| **Nom.** | der alt**e** Mann | die schön**e** Frau | das klein**e** Kind | die alt**en** Männer |
| **Akk.** | den alt**en** Mann | die schön**e** Frau | das klein**e** Kind | die alt**en** Männer |
| **Dat.** | dem alt**en** Mann | der schön**en** Frau | dem klein**en** Kind | den alt**en** Männern |
| **Gen.** | des alt**en** Mannes | der schön**en** Frau | des klein**en** Kindes | der alt**en** Männer |

---

### 2. Határozatlan névelővel (ein/eine/ein)
→ A melléknév veszi át a határozott névelő „erős" végződését ahol kell

| | Mask. | Fem. | Neutr. | Plur. (kein) |
|-|-------|------|--------|-------------|
| **Nom.** | ein alt**er** Mann | eine schön**e** Frau | ein klein**es** Kind | keine alt**en** Männer |
| **Akk.** | einen alt**en** Mann | eine schön**e** Frau | ein klein**es** Kind | keine alt**en** Männer |
| **Dat.** | einem alt**en** Mann | einer schön**en** Frau | einem klein**en** Kind | keinen alt**en** Männern |

---

### 3. Névelő nélkül
→ A melléknév maga mutatja az esetet (erős ragozás)

| | Mask. | Fem. | Neutr. | Plur. |
|-|-------|------|--------|-------|
| **Nom.** | alt**er** Mann | schön**e** Frau | klein**es** Kind | alt**e** Männer |
| **Akk.** | alt**en** Mann | schön**e** Frau | klein**es** Kind | alt**e** Männer |
| **Dat.** | alt**em** Mann | schön**er** Frau | alt**em** Kind | alt**en** Männern |
""",
        "tip": "💡 Memotechnika: ha a névelő már megmutatja az esetet (der/die/das/den/dem), a melléknév -e vagy -en végződést kap. Ha nem (ein+Nom. mask./neutr.), a melléknév veszi át a feladatot.",
    },

    "Trennbare Verben": {
        "title": "Trennbare & untrennbare Verben – Elváló és el nem váló igék",
        "content": """
### Elváló igék (trennbar)
Az előtag leválik az ige végére – **főmondatban**!

> *Ich **stehe** um 7 Uhr **auf**.* (aufstehen)
> *Er **ruft** mich **an**.* (anrufen)
> *Wir **kommen** morgen **an**.* (ankommen)

**Perfektben**: ge- az előtag és az igető közé kerül:
> *Ich bin **auf**ge**standen**.* · *Er hat **an**ge**rufen**.*

**Mellékmondatban** az ige nem válik el, a teljes alak a végén áll:
> *..., weil er mich **anruft**.* · *..., dass sie **aufsteht**.*

**Leggyakoribb elváló előtagok**: ab-, an-, auf-, aus-, ein-, mit-, nach-, vor-, zu-, zurück-, zusammen-

---

### El nem váló igék (untrennbar)
Ezek soha nem válnak el, és Perfektben **nincs ge-** előtag!

> *Ich **verstehe** das nicht.* (verstehen) → *Ich habe das **verstanden**.*
> *Er **besucht** mich.* (besuchen) → *Er hat mich **besucht**.*
> *Sie **erklärt** es.* (erklären) → *Sie hat es **erklärt**.*

**Untrennbare előtagok**: be-, ge-, er-, ver-, ent-, emp-, miss-, zer-

---

### Kétalakú igék (je előtag stresszes-e)
Néhány ige kétféleképpen használható, a jelentéstől függően:
> *Er **überSETZT** den Text.* (lefordítja) – el nem váló
> *Das Boot **SETZT** über.* (átkel) – elváló
""",
        "tip": "💡 Ha az előtag hangsúlyos (AUFstehen), elváló. Ha a tő hangsúlyos (verSTEHEN), el nem váló.",
    },

    "Präpositionen": {
        "title": "Präpositionen – Elöljárók (Wechselpräpositionen + igei vonzatok)",
        "content": """
### Wechselpräpositionen – Váltakozó elöljárók
Ez a 9 elöljáró hol Akkusatívot, hol Datívot vonz – a **jelentéstől** függ!

**an · auf · hinter · in · neben · über · unter · vor · zwischen**

| Kérdés | Eset | Jelentés | Példa |
|--------|------|---------|-------|
| **Wohin?** (Hova?) | Akkusativ | mozgás felé | Ich lege das Buch **auf den** Tisch. |
| **Wo?** (Hol?) | Dativ | helyzet, állapot | Das Buch liegt **auf dem** Tisch. |

> *Ich gehe **in die** Stadt.* (Wohin? → Akk.) – Bemegyek a városba.
> *Ich bin **in der** Stadt.* (Wo? → Dat.) – A városban vagyok.
> *Er hängt das Bild **an die** Wand.* (Wohin? → Akk.)
> *Das Bild hängt **an der** Wand.* (Wo? → Dat.)

---

### Feste Verbpräpositionen – Igék fix elöljárókkal

Ezeket **fejből kell tudni** – az elöljáró nem változtatható:

| Ige | Elöljáró + eset | Példa |
|-----|----------------|-------|
| warten | auf + Akk. | Ich warte **auf den** Bus. |
| denken | an + Akk. | Ich denke **an dich**. |
| sich freuen | über + Akk. | Ich freue mich **über das** Geschenk. |
| sich freuen | auf + Akk. | Ich freue mich **auf den** Urlaub. |
| sich interessieren | für + Akk. | Er interessiert sich **für** Musik. |
| sprechen | über + Akk. | Wir sprechen **über das** Thema. |
| fragen | nach + Dat. | Sie fragt **nach dem** Weg. |
| helfen | bei + Dat. | Er hilft mir **bei der** Arbeit. |
| teilnehmen | an + Dat. | Wir nehmen **an der** Konferenz teil. |

---

### Csak Dativ elöljárók: aus · bei · mit · nach · seit · von · zu · gegenüber
### Csak Akkusativ: durch · für · gegen · ohne · um
""",
        "tip": "💡 Wohin? = mozgás = Akkusativ · Wo? = helyzet = Dativ. Ha kétségeid vannak, tedd fel ezt a két kérdést!",
    },

    "Perfekt vs. Präteritum": {
        "title": "Perfekt vs. Präteritum – Múlt idők",
        "content": """
### Mikor melyiket?

| | Perfekt | Präteritum |
|-|---------|-----------|
| **Használat** | Beszélt nyelv, hétköznap | Írott nyelv, irodalom, hír |
| **Mikor?** | szóban szinte mindig | szövegben, elbeszélésben |
| **Kivétel** | sein/haben/modalverben → Prät. szóban is! | |

> ✅ *Ich habe gestern Deutsch gelernt.* (hétköznapi beszéd)
> ✅ *Er lernte täglich Deutsch.* (elbeszélő szöveg)
> ✅ *Ich **war** gestern müde.* (sein → Präteritum szóban is természetes)

---

### Perfekt képzése

**haben/sein + Partizip II**

Mikor `sein`? → mozgást jelölő vagy állapotváltozást kifejező igéknél:
*fahren, gehen, kommen, fliegen, laufen, werden, sein, bleiben, passieren, sterben...*

> *Ich **bin** nach Berlin **gefahren**.* · *Er **ist** gekommen.*
> *Ich **habe** das Buch **gelesen**.* · *Sie **hat** gegessen.*

**Partizip II képzése:**
- Gyenge igék: ge- + tő + -(e)t → *ge**macht**, ge**arbeitet***
- Erős igék: ge- + tő (változhat) + -en → *ge**schrieben**, ge**gangen***
- Elváló: ge- az előtag után → ***auf**ge**standen**, **ein**ge**kauft***
- El nem váló: ge- nélkül → ***ver**standen, **be**sucht*

---

### Präteritum – legfontosabb alakok (fejből!)

| Ige | ich/er | wir/sie |
|-----|--------|---------|
| sein | war | waren |
| haben | hatte | hatten |
| werden | wurde | wurden |
| können | konnte | konnten |
| müssen | musste | mussten |
| sollen | sollte | sollten |
| wollen | wollte | wollten |
| dürfen | durfte | durften |
""",
        "tip": "💡 Fő szabály: ha szóban mesélsz, Perfektet használj (kivéve: war, hatte, konnte, musste – ezeket Präteritumban mondjuk szóban is).",
    },

    "Nebensätze": {
        "title": "Nebensätze – Mellékmondatok",
        "content": """
### Szórend
A mellékmondat végén az **ige áll**. Ha ragozott és infinitív/Partizip is van, a **ragozott alak kerül a legvégére**:

> *Ich lerne, **weil** ich die Prüfung bestehen **will**.*
> *Er sagt, dass er das nicht **verstanden hat**.*

---

### Kausale Nebensätze – Ok (Miért?)

**weil / da** + V végén → az ok az ige után jön

> *Ich lerne Deutsch, **weil** es mir **gefällt**.*
> ***Da** ich müde **war**, bin ich früh ins Bett gegangen.*

⚠️ `weil` → csak mellékmondat · `denn` → mellérendelő (normál szórend!)
> *Ich lerne, **denn** es gefällt mir.* (denn után alany-ige sorrend!)

---

### Konzessive Nebensätze – Ellentét (Bár…)

**obwohl** + V végén → váratlan ellentét

> *Ich gehe spazieren, **obwohl** es **regnet**.*

⚠️ `obwohl` ≠ `trotzdem`: trotzdem főmondatot vezet be!
> *Es regnet. **Trotzdem** gehe ich spazieren.*

---

### Finale Nebensätze – Cél (Miért? Minek?)

**damit** + V végén (más az alany) vs. **um … zu** + Infin. (ugyanaz az alany)

> *Ich erkläre es langsam, **damit** du es **verstehst**.* (más az alany)
> *Ich lerne, **um** die Prüfung zu **bestehen**.* (ugyanaz az alany)

---

### Temporale Nebensätze – Idő

| Kötőszó | Használat | Példa |
|---------|-----------|-------|
| **als** | egyszer lezajlott múlt esemény | *Als ich jung war, wohnte ich in Budapest.* |
| **wenn** | jelen/jövő + ismételt múlt | *Wenn ich Zeit habe, lese ich.* |
| **nachdem** | időbeli sorrendiség (előbb–aztán) | *Nachdem er gegessen hatte, schlief er ein.* |
| **während** | párhuzamos cselekvés | *Während er schläft, arbeite ich.* |
| **bevor** | valami előtt | *Bevor du gehst, ruf mich an.* |

⚠️ `nachdem` → **Plusquamperfekt** a mellékmondat igéje!
> *Nachdem sie **gegessen hatte**, ging sie schlafen.*
""",
        "tip": "💡 Gyorsellenőrzés: mellékmondat kötőszó után? → ige a végén! Főmondat (denn, trotzdem, deshalb)? → normál alany-ige sorrend.",
    },

    "Nominalstil": {
        "title": "Nominalstil – Főnévi stílus (B2 írott nyelv)",
        "content": """
### Mi az a Nominalstil?
A hivatalos és tudományos írott német nyelvben az igéket **főnevekkel** fejezik ki.
Ez tömörebb, formálisabb és elvontabb hatást kelt.

---

### Verbalstil → Nominalstil átalakítás

| Igés (Verbalstil) | Főnévi (Nominalstil) |
|-------------------|---------------------|
| *Er entschied, dass...* | *Die **Entscheidung**, dass...* |
| *Wir kamen in Berlin an.* | *Nach unserer **Ankunft** in Berlin...* |
| *Der Zug kam zu spät.* | *Aufgrund der **Verspätung** des Zuges...* |
| *Man muss das beachten.* | *Die **Beachtung** dieses Punktes ist notwendig.* |

---

### Leggyakoribb főnévképzők igéből/melléknévből

| Képző | Példa | Nem |
|-------|-------|-----|
| **-ung** | entscheiden → die Entscheidung | die |
| **-ung** | lösen → die Lösung | die |
| **-heit** | krank → die Krankheit | die |
| **-keit** | möglich → die Möglichkeit | die |
| **-schaft** | Freund → die Freundschaft | die |
| **-nis** | erleben → das Erlebnis | das |
| **-ion** | diskutieren → die Diskussion | die |

---

### Elöljárós Nominalstil – Tipikus formulák

> ***Aufgrund** der schlechten Wetterlage wurde das Konzert abgesagt.*
> ***Wegen** der Verspätung verpasste er den Anschluss.*
> ***Trotz** der Schwierigkeiten gelang es ihm.*
> ***Während** des Meetings wurden wichtige Punkte besprochen.*
> ***Nach** der Ankunft in Wien besuchte er das Museum.*
> ***Vor** der Abreise packte sie ihren Koffer.*

---

### Participium mint melléknév (B2)

> *Das **renovierte** Gebäude sieht toll aus.* (das Gebäude, das renoviert wurde)
> *Die **ankommenden** Passagiere...* (die Passagiere, die ankommen)
""",
        "tip": "💡 Nominalstil főleg hivatalos levelekben, újságcikkekben, tudományos szövegekben fordul elő. Felismerni könnyű: sok főnév és kevés ige jellemzi.",
    },

    "Satzstruktur": {
        "title": "Satzstruktur – Mondatszerkezet és szórend",
        "content": """
### Az alaptörvény: az ige mindig a 2. pozícióban van (V2-szabály)

A német főmondatban a **ragozott ige MINDIG a 2. mondatrészen áll** – nem a 2. szón!

> *Ich **lerne** jeden Tag Deutsch.* ✅
> *Jeden Tag **lerne** ich Deutsch.* ✅ (időhatározóval kezdve → ige még mindig 2.)
> *Jeden Tag ich **lerne** Deutsch.* ❌ (ige a 3. helyen – HIBÁS!)

---

### Inverzió – ha nem az alany jön először

Ha a mondat **nem az alannyal kezdődik** (hanem időhatározóval, hellyel, kötőszóval stb.), az alany és az ige **felcserélődik**:

> *Heute **gehe** ich ins Kino.* (Heute = 1. pozíció → ige rögtön utána)
> *Deshalb **hat** er nicht geantwortet.*
> *In Berlin **wohnt** meine Schwester.*

⚠️ Tipikus hiba: *Heute ich gehe ins Kino.* ❌

---

### Satzklammer – a mondat kerete

Ha az ige **két részből áll** (segédige + főnévi igenév / Partizip II / elváló előtag), a két rész **keretet alkot**: a ragozott ige a 2. pozícióban, a többi a **mondat végén**.

| Mondat | Ragozott ige (2.) | ... | Végső rész |
|--------|-------------------|-----|-----------|
| *Ich **habe** gestern Deutsch* | habe | gestern Deutsch | *gelernt.* |
| *Er **kann** heute nicht* | kann | heute nicht | *kommen.* |
| *Sie **ruft** mich morgen* | ruft | mich morgen | *an.* (anrufen) |

---

### TeKaMoLo – határozók sorrendje

Ha egy mondatban több határozó van, az alábbi sorrendben állnak:

**Te**mporal → **Ka**usal → **Mo**dal → **Lo**kal

> *Ich fahre **morgen** (Te) **wegen der Arbeit** (Ka) **mit dem Zug** (Mo) **nach Wien** (Lo).*

Nem kell mindig mind a négy, de ha kettő vagy több van, ezt a sorrendet kövesd:
- ❌ *Ich fahre nach Wien mit dem Zug morgen.*
- ✅ *Ich fahre morgen mit dem Zug nach Wien.*

---

### Nebensatz – mellékmondatban a ragozott ige a végén

Kötőszó (weil, dass, obwohl, wenn, als…) után **az ige a mondat végére kerül**:

> *Ich lerne Deutsch, weil es mir **gefällt**.*
> *Er sagt, dass er morgen nicht **kommen kann**.*
> *Obwohl es regnet, gehen wir **spazieren**.*

Ha két igés alak van, általában: infinitív/Partizip II **előbb**, ragozott alak **utoljára**:
> *..., weil er das nicht **verstanden hat**.*
> *..., dass sie kommen **will**.*

---

### `nicht` helyzete

- Egész mondatot tagad → **a mondat végén** (de az infinitív/Partizip előtt):
  > *Ich gehe heute **nicht**.* · *Er hat das **nicht** gesagt.*
- Egy szót/részt tagad → **közvetlenül az előtt**:
  > *Ich fahre **nicht** nach Berlin, sondern nach Wien.*
""",
        "tip": "💡 Leggyakoribb hiba: az alany és az ige nem cserél helyet inverziókor. Ellenőrző kérdés: hányadik pozícióban van a ragozott ige? Mindig a 2.-nak kell lennie.",
    },
}

SESSION_TYPES = {
    "lueckentext": {
        "label": "Lückentext",
        "icon": "📝",
        "description": "Töltsd ki a hiányzó szavakat",
        "count": 6,
    },
    "fehlerkorrektur": {
        "label": "Fehlerkorrektur",
        "icon": "✏️",
        "description": "Javítsd ki a hibás mondatokat",
        "count": 6,
    },
    "schreiben": {
        "label": "Freies Schreiben",
        "icon": "📖",
        "description": "Írj 3-5 mondatot egy adott témáról",
        "count": 3,
    },
    "grammatik": {
        "label": "Grammatik-Drill",
        "icon": "🔧",
        "description": "Intenzív grammatika gyakorlás a gyenge területeken",
        "count": 8,
    },
    "vokabeln": {
        "label": "Vokabeln",
        "icon": "🃏",
        "description": "Szókincs ismétlés (spaced repetition)",
        "count": 8,
    },
    "satzstruktur": {
        "label": "Satzstruktur",
        "icon": "🔀",
        "description": "Mondatszerkezet és szórend (V2, Satzklammer, TeKaMoLo)",
        "count": 8,
    },
}
