| Feature                | Surya OCR  | PaddleOCR     | GLM-OCR                                          |
| ---------------------- | ---------- | ------------- | ------------------------------------------------ |
| Open Source            | ✅ MIT     | ✅ Apache 2.0 | ⚠️ Model available, licensing depends on release |
| Self-hostable          | ✅ Yes     | ✅ Yes        | ✅ Yes (large GPU recommended)                   |
| GPU Required           | Optional   | Optional      | Recommended                                      |
| CPU Performance        | Good       | Excellent     | Poor                                             |
| Printed Text           | ⭐⭐⭐⭐☆  | ⭐⭐⭐⭐⭐    | ⭐⭐⭐⭐⭐                                       |
| Handwriting            | ⭐⭐⭐☆☆   | ⭐⭐⭐☆☆      | ⭐⭐⭐⭐☆                                        |
| Tables                 | ⭐⭐⭐⭐☆  | ⭐⭐⭐⭐⭐    | ⭐⭐⭐⭐☆                                        |
| Multi-column Docs      | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐☆     | ⭐⭐⭐⭐⭐                                       |
| PDFs                   | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐☆     | ⭐⭐⭐⭐⭐                                       |
| OCR Speed              | Fast       | Very Fast     | Slow                                             |
| Memory Usage           | Low        | Low           | High                                             |
| Layout Detection       | Excellent  | Good          | Excellent                                        |
| Document Understanding | Basic      | Basic         | Excellent                                        |
| Structured JSON Output | Limited    | Good          | Excellent                                        |
| Best For               | Documents  | General OCR   | AI document understanding                        |


Speed


| OCR Engine | Relative Speed |
| ---------- | -------------- |
| PaddleOCR  | ⭐⭐⭐⭐⭐       |
| Surya      | ⭐⭐⭐⭐☆        |
| GLM-OCR    | ⭐⭐☆☆☆         |


OCR Accuracy

| Document Type   | Paddle | Surya | GLM   |
| --------------- | ------ | ----- | ----- |
| Printed docs    | ⭐⭐⭐⭐⭐  | ⭐⭐⭐⭐☆ | ⭐⭐⭐⭐⭐ |
| Books           | ⭐⭐⭐⭐☆  | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Scientific PDFs | ⭐⭐⭐☆☆  | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Tables          | ⭐⭐⭐⭐⭐  | ⭐⭐⭐⭐☆ | ⭐⭐⭐⭐☆ |
| Receipts        | ⭐⭐⭐⭐⭐  | ⭐⭐⭐⭐☆ | ⭐⭐⭐⭐☆ |
| Forms           | ⭐⭐⭐⭐⭐  | ⭐⭐⭐⭐☆ | ⭐⭐⭐⭐⭐ |
| Handwriting     | ⭐⭐⭐☆☆  | ⭐⭐⭐☆☆ | ⭐⭐⭐⭐☆ |
| Complex Layout  | ⭐⭐⭐☆☆  | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |


{
  "paddle": {
    "engine": "paddle",
    "processing_time": 30.52,
    "pages": 1,
    "text": "ORDEN DE COMPRA\nVendo lo que tengo S.L.\nVendo lo que tengo S.L., 1. 08001 Barcelona, España\nPARA\nFarola Rec 67 partners s.1.\nOrden n°:\n5946\nCarrer Antic de Sant Joan, 10, local\nFecha:\n10/6/2026\n08003 Barcelona\nEspaña\nNIF/CIN:\nB-67019018\nDescripción\nCantidad\nPrecio (€)\nDescuento %\nImporte (€)\nPomelo\n0,3 kg\n2,50\n0,00\n0,75\nlima\n1,405 kg\n3,50\n0,00\n4,92\nNaranja\n0,58 kg\n1,99\n0,00\n1,15\nTomate pera\n0,41 kg\n1,69\n0,00\n0,69\nlimon Z>\n1 kg\n0,00\n8,50\n8,50\n1 un\n0,00\n9,00\ncafe\n9,00\n25,01 €\nTotal (EUR):",
    "confidence": 0.9957,
    "layout": [
      {
        "page": 1,
        "box": [
          896,
          204,
          1491,
          289
        ],
        "text": "ORDEN DE COMPRA",
        "confidence": 0.9997053146362305
      },
      {
        "page": 1,
        "box": [
          817,
          315,
          1562,
          419
        ],
        "text": "Vendo lo que tengo S.L.",
        "confidence": 0.9999650716781616
      },
      {
        "page": 1,
        "box": [
          850,
          409,
          1507,
          464
        ],
        "text": "Vendo lo que tengo S.L., 1. 08001 Barcelona, España",
        "confidence": 0.9780222773551941
      },
      {
        "page": 1,
        "box": [
          197,
          505,
          299,
          554
        ],
        "text": "PARA",
        "confidence": 0.9999850988388062
      },
      {
        "page": 1,
        "box": [
          197,
          561,
          530,
          614
        ],
        "text": "Farola Rec 67 partners s.1.",
        "confidence": 0.9858811497688293
      },
      {
        "page": 1,
        "box": [
          1625,
          567,
          1758,
          609
        ],
        "text": "Orden n°:",
        "confidence": 0.9771518707275391
      },
      {
        "page": 1,
        "box": [
          2082,
          572,
          2158,
          613
        ],
        "text": "5946",
        "confidence": 0.9999990463256836
      },
      {
        "page": 1,
        "box": [
          197,
          609,
          643,
          659
        ],
        "text": "Carrer Antic de Sant Joan, 10, local",
        "confidence": 0.9999039173126221
      },
      {
        "page": 1,
        "box": [
          1620,
          609,
          1721,
          655
        ],
        "text": "Fecha:",
        "confidence": 0.9708805084228516
      },
      {
        "page": 1,
        "box": [
          2020,
          616,
          2154,
          657
        ],
        "text": "10/6/2026",
        "confidence": 0.9999972581863403
      },
      {
        "page": 1,
        "box": [
          198,
          654,
          418,
          696
        ],
        "text": "08003 Barcelona",
        "confidence": 0.9999764561653137
      },
      {
        "page": 1,
        "box": [
          192,
          695,
          302,
          747
        ],
        "text": "España",
        "confidence": 0.9998959898948669
      },
      {
        "page": 1,
        "box": [
          191,
          785,
          325,
          831
        ],
        "text": "NIF/CIN:",
        "confidence": 0.9996042847633362
      },
      {
        "page": 1,
        "box": [
          582,
          790,
          747,
          831
        ],
        "text": "B-67019018",
        "confidence": 0.9999977350234985
      },
      {
        "page": 1,
        "box": [
          179,
          899,
          352,
          951
        ],
        "text": "Descripción",
        "confidence": 0.9998229742050171
      },
      {
        "page": 1,
        "box": [
          812,
          907,
          946,
          949
        ],
        "text": "Cantidad",
        "confidence": 0.9999951124191284
      },
      {
        "page": 1,
        "box": [
          1153,
          907,
          1291,
          956
        ],
        "text": "Precio (€)",
        "confidence": 0.9976506233215332
      },
      {
        "page": 1,
        "box": [
          1566,
          905,
          1743,
          945
        ],
        "text": "Descuento %",
        "confidence": 0.9997077584266663
      },
      {
        "page": 1,
        "box": [
          1996,
          906,
          2158,
          953
        ],
        "text": "Importe (€)",
        "confidence": 0.9989122748374939
      },
      {
        "page": 1,
        "box": [
          178,
          991,
          291,
          1037
        ],
        "text": "Pomelo",
        "confidence": 0.9998719692230225
      },
      {
        "page": 1,
        "box": [
          850,
          992,
          949,
          1048
        ],
        "text": "0,3 kg",
        "confidence": 0.9986018538475037
      },
      {
        "page": 1,
        "box": [
          1220,
          991,
          1294,
          1043
        ],
        "text": "2,50",
        "confidence": 0.9998928904533386
      },
      {
        "page": 1,
        "box": [
          1679,
          990,
          1752,
          1038
        ],
        "text": "0,00",
        "confidence": 0.9997066259384155
      },
      {
        "page": 1,
        "box": [
          2088,
          989,
          2164,
          1039
        ],
        "text": "0,75",
        "confidence": 0.9799318909645081
      },
      {
        "page": 1,
        "box": [
          176,
          1081,
          251,
          1124
        ],
        "text": "lima",
        "confidence": 0.9999233484268188
      },
      {
        "page": 1,
        "box": [
          823,
          1083,
          946,
          1134
        ],
        "text": "1,405 kg",
        "confidence": 0.9995541572570801
      },
      {
        "page": 1,
        "box": [
          1219,
          1079,
          1294,
          1130
        ],
        "text": "3,50",
        "confidence": 0.9999279975891113
      },
      {
        "page": 1,
        "box": [
          1680,
          1081,
          1751,
          1125
        ],
        "text": "0,00",
        "confidence": 0.9977149367332458
      },
      {
        "page": 1,
        "box": [
          2094,
          1079,
          2166,
          1123
        ],
        "text": "4,92",
        "confidence": 0.9887291789054871
      },
      {
        "page": 1,
        "box": [
          173,
          1168,
          292,
          1218
        ],
        "text": "Naranja",
        "confidence": 0.9999217987060547
      },
      {
        "page": 1,
        "box": [
          835,
          1171,
          946,
          1225
        ],
        "text": "0,58 kg",
        "confidence": 0.9993396997451782
      },
      {
        "page": 1,
        "box": [
          1221,
          1170,
          1290,
          1220
        ],
        "text": "1,99",
        "confidence": 0.9999136924743652
      },
      {
        "page": 1,
        "box": [
          1679,
          1168,
          1752,
          1217
        ],
        "text": "0,00",
        "confidence": 0.999677300453186
      },
      {
        "page": 1,
        "box": [
          2094,
          1159,
          2173,
          1214
        ],
        "text": "1,15",
        "confidence": 0.9998446702957153
      },
      {
        "page": 1,
        "box": [
          176,
          1262,
          346,
          1304
        ],
        "text": "Tomate pera",
        "confidence": 0.9999759793281555
      },
      {
        "page": 1,
        "box": [
          834,
          1258,
          945,
          1314
        ],
        "text": "0,41 kg",
        "confidence": 0.9997202754020691
      },
      {
        "page": 1,
        "box": [
          1221,
          1261,
          1290,
          1309
        ],
        "text": "1,69",
        "confidence": 0.9999644756317139
      },
      {
        "page": 1,
        "box": [
          1679,
          1260,
          1751,
          1308
        ],
        "text": "0,00",
        "confidence": 0.9997730255126953
      },
      {
        "page": 1,
        "box": [
          2099,
          1254,
          2174,
          1300
        ],
        "text": "0,69",
        "confidence": 0.9994755983352661
      },
      {
        "page": 1,
        "box": [
          172,
          1348,
          304,
          1390
        ],
        "text": "limon Z>",
        "confidence": 0.9986873269081116
      },
      {
        "page": 1,
        "box": [
          871,
          1346,
          946,
          1400
        ],
        "text": "1 kg",
        "confidence": 0.981673002243042
      },
      {
        "page": 1,
        "box": [
          1679,
          1349,
          1753,
          1397
        ],
        "text": "0,00",
        "confidence": 0.9996200799942017
      },
      {
        "page": 1,
        "box": [
          2102,
          1340,
          2180,
          1388
        ],
        "text": "8,50",
        "confidence": 0.9997718334197998
      },
      {
        "page": 1,
        "box": [
          1218,
          1349,
          1292,
          1400
        ],
        "text": "8,50",
        "confidence": 0.9999771118164062
      },
      {
        "page": 1,
        "box": [
          874,
          1437,
          943,
          1479
        ],
        "text": "1 un",
        "confidence": 0.9970085620880127
      },
      {
        "page": 1,
        "box": [
          1681,
          1437,
          1755,
          1485
        ],
        "text": "0,00",
        "confidence": 0.9994038939476013
      },
      {
        "page": 1,
        "box": [
          2110,
          1428,
          2186,
          1475
        ],
        "text": "9,00",
        "confidence": 0.996282696723938
      },
      {
        "page": 1,
        "box": [
          169,
          1440,
          242,
          1483
        ],
        "text": "cafe",
        "confidence": 0.9999929070472717
      },
      {
        "page": 1,
        "box": [
          1219,
          1438,
          1290,
          1486
        ],
        "text": "9,00",
        "confidence": 0.9429812431335449
      },
      {
        "page": 1,
        "box": [
          2053,
          1501,
          2195,
          1559
        ],
        "text": "25,01 €",
        "confidence": 0.9973021745681763
      },
      {
        "page": 1,
        "box": [
          171,
          1519,
          404,
          1566
        ],
        "text": "Total (EUR):",
        "confidence": 0.9982538223266602
      }
    ],
    "structured_output": null,
    "metadata": {
      "simulated": false,
      "device": "CPU"
    }
  },
  "surya": {
    "engine": "surya",
    "processing_time": 75.72,
    "pages": 1,
    "text": " ORDEN DE COMPRA\nVendo lo que tengo S.L.\nVendo lo que tengo S.L., 1, 08001 Barcelona, España\nPARA\nFarola Rec 67 partners s.l.\nCarrer Antic de Sant Joan, 10, local\nOrden n°:\n08003 Barcelona\n596\nFecha:\nEspañan\n10/6/2026\nNIF/CIN:\nB-67019018\nDescripción\nCantidad\nPrecio (€)\nDescuento %\nImporte (E)\nPomelo\n0,3 kg\n2,50\n0,00\n0,75\nlima\n1,405 kg\n3,50\n0,00\n4,92\nNaranja\n0,58 kg\n1,99\n0,00\n1,15\nTomate pera\n0,41 kg \n1,69\n0,00\n0,69\nlimon Z>\nl kg\n8,50\n0,00\n8,50\ncafe\nl un\n9,00\n0,00\n9,00\nTotal (EUR):\n25,01 €",
    "confidence": 0.9486,
    "layout": [
      {
        "page": 1,
        "box": [
          966,
          360,
          1561,
          466
        ],
        "text": " ORDEN DE COMPRA",
        "confidence": 0.9814453125
      },
      {
        "page": 1,
        "box": [
          906,
          450,
          1634,
          580
        ],
        "text": "Vendo lo que tengo S.L.",
        "confidence": 0.99755859375
      },
      {
        "page": 1,
        "box": [
          931,
          536,
          1574,
          620
        ],
        "text": "Vendo lo que tengo S.L., 1, 08001 Barcelona, España",
        "confidence": 0.98681640625
      },
      {
        "page": 1,
        "box": [
          302,
          613,
          406,
          648
        ],
        "text": "PARA",
        "confidence": 0.99072265625
      },
      {
        "page": 1,
        "box": [
          301,
          653,
          635,
          707
        ],
        "text": "Farola Rec 67 partners s.l.",
        "confidence": 0.99609375
      },
      {
        "page": 1,
        "box": [
          294,
          695,
          749,
          751
        ],
        "text": "Carrer Antic de Sant Joan, 10, local",
        "confidence": 0.994140625
      },
      {
        "page": 1,
        "box": [
          1671,
          719,
          1801,
          758
        ],
        "text": "Orden n°:",
        "confidence": 0.91796875
      },
      {
        "page": 1,
        "box": [
          295,
          736,
          520,
          778
        ],
        "text": "08003 Barcelona",
        "confidence": 0.994140625
      },
      {
        "page": 1,
        "box": [
          2078,
          745,
          2152,
          779
        ],
        "text": "596",
        "confidence": 0.95703125
      },
      {
        "page": 1,
        "box": [
          1670,
          762,
          1765,
          796
        ],
        "text": "Fecha:",
        "confidence": 0.98681640625
      },
      {
        "page": 1,
        "box": [
          294,
          779,
          402,
          813
        ],
        "text": "Españan",
        "confidence": 0.916015625
      },
      {
        "page": 1,
        "box": [
          2023,
          782,
          2150,
          818
        ],
        "text": "10/6/2026",
        "confidence": 0.98828125
      },
      {
        "page": 1,
        "box": [
          285,
          855,
          423,
          893
        ],
        "text": "NIF/CIN:",
        "confidence": 0.982421875
      },
      {
        "page": 1,
        "box": [
          668,
          867,
          844,
          912
        ],
        "text": "B-67019018",
        "confidence": 0.96923828125
      },
      {
        "page": 1,
        "box": [
          268,
          958,
          442,
          1000
        ],
        "text": "Descripción",
        "confidence": 0.96826171875
      },
      {
        "page": 1,
        "box": [
          890,
          991,
          1033,
          1028
        ],
        "text": "Cantidad",
        "confidence": 0.97998046875
      },
      {
        "page": 1,
        "box": [
          1223,
          1008,
          1366,
          1052
        ],
        "text": "Precio (€)",
        "confidence": 0.92529296875
      },
      {
        "page": 1,
        "box": [
          1618,
          1019,
          1798,
          1061
        ],
        "text": "Descuento %",
        "confidence": 0.970703125
      },
      {
        "page": 1,
        "box": [
          2007,
          1035,
          2165,
          1082
        ],
        "text": "Importe (E)",
        "confidence": 0.951171875
      },
      {
        "page": 1,
        "box": [
          265,
          1045,
          378,
          1080
        ],
        "text": "Pomelo",
        "confidence": 0.98583984375
      },
      {
        "page": 1,
        "box": [
          931,
          1077,
          1031,
          1115
        ],
        "text": "0,3 kg",
        "confidence": 0.9521484375
      },
      {
        "page": 1,
        "box": [
          1293,
          1092,
          1367,
          1128
        ],
        "text": "2,50",
        "confidence": 0.9775390625
      },
      {
        "page": 1,
        "box": [
          1724,
          1103,
          1800,
          1138
        ],
        "text": "0,00",
        "confidence": 0.9638671875
      },
      {
        "page": 1,
        "box": [
          2092,
          1122,
          2164,
          1155
        ],
        "text": "0,75",
        "confidence": 0.9130859375
      },
      {
        "page": 1,
        "box": [
          263,
          1130,
          334,
          1162
        ],
        "text": "lima",
        "confidence": 0.9970703125
      },
      {
        "page": 1,
        "box": [
          904,
          1158,
          1027,
          1198
        ],
        "text": "1,405 kg",
        "confidence": 0.9755859375
      },
      {
        "page": 1,
        "box": [
          1289,
          1173,
          1363,
          1204
        ],
        "text": "3,50",
        "confidence": 0.9755859375
      },
      {
        "page": 1,
        "box": [
          1724,
          1182,
          1808,
          1218
        ],
        "text": "0,00",
        "confidence": 0.89306640625
      },
      {
        "page": 1,
        "box": [
          2093,
          1196,
          2166,
          1233
        ],
        "text": "4,92",
        "confidence": 0.96337890625
      },
      {
        "page": 1,
        "box": [
          257,
          1214,
          380,
          1251
        ],
        "text": "Naranja",
        "confidence": 0.9833984375
      },
      {
        "page": 1,
        "box": [
          910,
          1241,
          1031,
          1281
        ],
        "text": "0,58 kg",
        "confidence": 0.8916015625
      },
      {
        "page": 1,
        "box": [
          1287,
          1251,
          1367,
          1290
        ],
        "text": "1,99",
        "confidence": 0.97265625
      },
      {
        "page": 1,
        "box": [
          1724,
          1262,
          1802,
          1297
        ],
        "text": "0,00",
        "confidence": 0.96240234375
      },
      {
        "page": 1,
        "box": [
          2092,
          1275,
          2168,
          1311
        ],
        "text": "1,15",
        "confidence": 0.7880859375
      },
      {
        "page": 1,
        "box": [
          258,
          1299,
          436,
          1340
        ],
        "text": "Tomate pera",
        "confidence": 0.99560546875
      },
      {
        "page": 1,
        "box": [
          910,
          1323,
          1031,
          1364
        ],
        "text": "0,41 kg ",
        "confidence": 0.86962890625
      },
      {
        "page": 1,
        "box": [
          1285,
          1334,
          1363,
          1371
        ],
        "text": "1,69",
        "confidence": 0.9169921875
      },
      {
        "page": 1,
        "box": [
          1720,
          1342,
          1799,
          1379
        ],
        "text": "0,00",
        "confidence": 0.91650390625
      },
      {
        "page": 1,
        "box": [
          2092,
          1353,
          2174,
          1388
        ],
        "text": "0,69",
        "confidence": 0.9189453125
      },
      {
        "page": 1,
        "box": [
          250,
          1383,
          388,
          1421
        ],
        "text": "limon Z>",
        "confidence": 0.9853515625
      },
      {
        "page": 1,
        "box": [
          943,
          1408,
          1025,
          1447
        ],
        "text": "l kg",
        "confidence": 0.859375
      },
      {
        "page": 1,
        "box": [
          1281,
          1414,
          1361,
          1452
        ],
        "text": "8,50",
        "confidence": 0.9384765625
      },
      {
        "page": 1,
        "box": [
          1718,
          1424,
          1799,
          1460
        ],
        "text": "0,00",
        "confidence": 0.83056640625
      },
      {
        "page": 1,
        "box": [
          2097,
          1433,
          2174,
          1468
        ],
        "text": "8,50",
        "confidence": 0.91259765625
      },
      {
        "page": 1,
        "box": [
          242,
          1471,
          324,
          1505
        ],
        "text": "cafe",
        "confidence": 0.96240234375
      },
      {
        "page": 1,
        "box": [
          945,
          1491,
          1027,
          1525
        ],
        "text": "l un",
        "confidence": 0.9609375
      },
      {
        "page": 1,
        "box": [
          1279,
          1496,
          1363,
          1532
        ],
        "text": "9,00",
        "confidence": 0.91015625
      },
      {
        "page": 1,
        "box": [
          1716,
          1504,
          1799,
          1540
        ],
        "text": "0,00",
        "confidence": 0.89208984375
      },
      {
        "page": 1,
        "box": [
          2099,
          1510,
          2174,
          1546
        ],
        "text": "9,00",
        "confidence": 0.9658203125
      },
      {
        "page": 1,
        "box": [
          242,
          1542,
          493,
          1589
        ],
        "text": "Total (EUR):",
        "confidence": 0.984375
      },
      {
        "page": 1,
        "box": [
          2039,
          1575,
          2174,
          1619
        ],
        "text": "25,01 €",
        "confidence": 0.9111328125
      }
    ],
    "structured_output": null,
    "metadata": {
      "simulated": false,
      "device": "CPU"
    }
  },
  "glm": null
}