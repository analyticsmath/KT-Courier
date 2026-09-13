export interface CustomerIdentity {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: {
    line1: string;
    suburb: string;
    city: string;
    province: string;
    postalCode: string;
    lat: number;
    lng: number;
  };
}

export const DEMO_CUSTOMERS: CustomerIdentity[] = [
  {
    "id": "cust-0001",
    "email": "sizwe.zulu1@example.co.za",
    "firstName": "Sizwe",
    "lastName": "Zulu",
    "phone": "+27 79 534 6708",
    "address": {
      "line1": "285 7th Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.14371,
      "lng": 28.009094
    }
  },
  {
    "id": "cust-0002",
    "email": "tanya.chetty2@example.co.za",
    "firstName": "Tanya",
    "lastName": "Chetty",
    "phone": "+27 84 780 9785",
    "address": {
      "line1": "199 7th Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.776596,
      "lng": 28.283364
    }
  },
  {
    "id": "cust-0003",
    "email": "kefilwe.gxilishe3@example.co.za",
    "firstName": "Kefilwe",
    "lastName": "Gxilishe",
    "phone": "+27 84 592 5408",
    "address": {
      "line1": "312 Grant Avenue, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.175555,
      "lng": 28.015999
    }
  },
  {
    "id": "cust-0004",
    "email": "brett.nkosi4@example.co.za",
    "firstName": "Brett",
    "lastName": "Nkosi",
    "phone": "+27 82 458 6133",
    "address": {
      "line1": "20 Duncan Street, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.172206,
      "lng": 28.01084
    }
  },
  {
    "id": "cust-0005",
    "email": "brett.pillay5@example.co.za",
    "firstName": "Brett",
    "lastName": "Pillay",
    "phone": "+27 76 435 4182",
    "address": {
      "line1": "449 Fehrsen Street, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.109372,
      "lng": 28.061634
    }
  },
  {
    "id": "cust-0006",
    "email": "rajesh.moyo6@example.co.za",
    "firstName": "Rajesh",
    "lastName": "Moyo",
    "phone": "+27 82 344 6444",
    "address": {
      "line1": "61 Stanley Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.023774,
      "lng": 28.003374
    }
  },
  {
    "id": "cust-0007",
    "email": "michael.singh7@example.co.za",
    "firstName": "Michael",
    "lastName": "Singh",
    "phone": "+27 76 574 3475",
    "address": {
      "line1": "1 Juta Street, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.152087,
      "lng": 28.034879
    }
  },
  {
    "id": "cust-0008",
    "email": "priya.mokoena8@example.co.za",
    "firstName": "Priya",
    "lastName": "Mokoena",
    "phone": "+27 84 782 7496",
    "address": {
      "line1": "295 Charles Street, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.167655,
      "lng": 27.997408
    }
  },
  {
    "id": "cust-0009",
    "email": "willem.nkosi9@example.co.za",
    "firstName": "Willem",
    "lastName": "Nkosi",
    "phone": "+27 76 988 6397",
    "address": {
      "line1": "406 Main Road, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.74009,
      "lng": 28.247297
    }
  },
  {
    "id": "cust-0010",
    "email": "neo.ndlovu10@example.co.za",
    "firstName": "Neo",
    "lastName": "Ndlovu",
    "phone": "+27 83 582 4733",
    "address": {
      "line1": "77 Sandton Drive, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.139119,
      "lng": 28.010444
    }
  },
  {
    "id": "cust-0011",
    "email": "lindiwe.dlamini11@example.co.za",
    "firstName": "Lindiwe",
    "lastName": "Dlamini",
    "phone": "+27 79 620 7726",
    "address": {
      "line1": "37 Duncan Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.005812,
      "lng": 28.008918
    }
  },
  {
    "id": "cust-0012",
    "email": "andile.daniels12@example.co.za",
    "firstName": "Andile",
    "lastName": "Daniels",
    "phone": "+27 76 423 2266",
    "address": {
      "line1": "297 Jan Smuts Avenue, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.791968,
      "lng": 28.267601
    }
  },
  {
    "id": "cust-0013",
    "email": "tendai.nel13@example.co.za",
    "firstName": "Tendai",
    "lastName": "Nel",
    "phone": "+27 84 182 6908",
    "address": {
      "line1": "100 Jan Smuts Avenue, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.10027,
      "lng": 28.054769
    }
  },
  {
    "id": "cust-0014",
    "email": "helena.khumalo14@example.co.za",
    "firstName": "Helena",
    "lastName": "Khumalo",
    "phone": "+27 82 550 1873",
    "address": {
      "line1": "425 4th Avenue, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.02101,
      "lng": 28.011899
    }
  },
  {
    "id": "cust-0015",
    "email": "puleng.naidoo15@example.co.za",
    "firstName": "Puleng",
    "lastName": "Naidoo",
    "phone": "+27 76 151 9052",
    "address": {
      "line1": "33 De Korte Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.006776,
      "lng": 28.00602
    }
  },
  {
    "id": "cust-0016",
    "email": "lebohang.mokoena16@example.co.za",
    "firstName": "Lebohang",
    "lastName": "Mokoena",
    "phone": "+27 79 873 6999",
    "address": {
      "line1": "368 Fehrsen Street, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.148607,
      "lng": 28.041785
    }
  },
  {
    "id": "cust-0017",
    "email": "dineo.ncube17@example.co.za",
    "firstName": "Dineo",
    "lastName": "Ncube",
    "phone": "+27 83 272 4937",
    "address": {
      "line1": "409 Juta Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.140816,
      "lng": 28.009684
    }
  },
  {
    "id": "cust-0018",
    "email": "christo.maharaj18@example.co.za",
    "firstName": "Christo",
    "lastName": "Maharaj",
    "phone": "+27 76 770 5754",
    "address": {
      "line1": "366 Grant Avenue, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.14368,
      "lng": 28.008188
    }
  },
  {
    "id": "cust-0019",
    "email": "zola.barnardo19@example.co.za",
    "firstName": "Zola",
    "lastName": "Barnardo",
    "phone": "+27 72 555 2007",
    "address": {
      "line1": "283 Sandton Drive, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.136195,
      "lng": 28.010128
    }
  },
  {
    "id": "cust-0020",
    "email": "tendai.singh20@example.co.za",
    "firstName": "Tendai",
    "lastName": "Singh",
    "phone": "+27 84 385 4917",
    "address": {
      "line1": "288 Oxford Road, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.183995,
      "lng": 28.037006
    }
  },
  {
    "id": "cust-0021",
    "email": "mpho.meyer21@example.co.za",
    "firstName": "Mpho",
    "lastName": "Meyer",
    "phone": "+27 82 180 7374",
    "address": {
      "line1": "244 Lynnwood Road, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.014147,
      "lng": 28.004637
    }
  },
  {
    "id": "cust-0022",
    "email": "helena.reddy22@example.co.za",
    "firstName": "Helena",
    "lastName": "Reddy",
    "phone": "+27 76 730 6932",
    "address": {
      "line1": "143 Sandton Drive, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.165801,
      "lng": 27.99743
    }
  },
  {
    "id": "cust-0023",
    "email": "katlego.chetty23@example.co.za",
    "firstName": "Katlego",
    "lastName": "Chetty",
    "phone": "+27 83 590 7814",
    "address": {
      "line1": "364 Main Road, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.853816,
      "lng": 28.184998
    }
  },
  {
    "id": "cust-0024",
    "email": "kudzai.mokoena24@example.co.za",
    "firstName": "Kudzai",
    "lastName": "Mokoena",
    "phone": "+27 84 782 1909",
    "address": {
      "line1": "418 Rivonia Road, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.153044,
      "lng": 28.0734
    }
  },
  {
    "id": "cust-0025",
    "email": "itumeleng.maharaj25@example.co.za",
    "firstName": "Itumeleng",
    "lastName": "Maharaj",
    "phone": "+27 83 196 9773",
    "address": {
      "line1": "249 William Nicol Drive, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.783793,
      "lng": 28.280724
    }
  },
  {
    "id": "cust-0026",
    "email": "farai.dlamini26@example.co.za",
    "firstName": "Farai",
    "lastName": "Dlamini",
    "phone": "+27 82 586 1628",
    "address": {
      "line1": "35 Grant Avenue, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.781143,
      "lng": 28.268693
    }
  },
  {
    "id": "cust-0027",
    "email": "sunil.claassen27@example.co.za",
    "firstName": "Sunil",
    "lastName": "Claassen",
    "phone": "+27 72 476 4362",
    "address": {
      "line1": "288 7th Street, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.113437,
      "lng": 28.048412
    }
  },
  {
    "id": "cust-0028",
    "email": "helena.gumbo28@example.co.za",
    "firstName": "Helena",
    "lastName": "Gumbo",
    "phone": "+27 76 454 7531",
    "address": {
      "line1": "1 Rivonia Road, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.191437,
      "lng": 28.021745
    }
  },
  {
    "id": "cust-0029",
    "email": "claire.snyman29@example.co.za",
    "firstName": "Claire",
    "lastName": "Snyman",
    "phone": "+27 79 975 1358",
    "address": {
      "line1": "52 7th Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.148045,
      "lng": 28.070426
    }
  },
  {
    "id": "cust-0030",
    "email": "sibusiso.daniels30@example.co.za",
    "firstName": "Sibusiso",
    "lastName": "Daniels",
    "phone": "+27 83 762 2731",
    "address": {
      "line1": "153 Juta Street, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.138193,
      "lng": 28.035306
    }
  },
  {
    "id": "cust-0031",
    "email": "marike.singh31@example.co.za",
    "firstName": "Marike",
    "lastName": "Singh",
    "phone": "+27 79 303 6206",
    "address": {
      "line1": "148 Lynnwood Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.155399,
      "lng": 28.042925
    }
  },
  {
    "id": "cust-0032",
    "email": "stephan.claassen32@example.co.za",
    "firstName": "Stephan",
    "lastName": "Claassen",
    "phone": "+27 83 555 4005",
    "address": {
      "line1": "265 Charles Street, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.772988,
      "lng": 28.244529
    }
  },
  {
    "id": "cust-0033",
    "email": "jan.matlala33@example.co.za",
    "firstName": "Jan",
    "lastName": "Matlala",
    "phone": "+27 79 439 3017",
    "address": {
      "line1": "315 Grant Avenue, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.179079,
      "lng": 28.002414
    }
  },
  {
    "id": "cust-0034",
    "email": "sunil.grobbelaar34@example.co.za",
    "firstName": "Sunil",
    "lastName": "Grobbelaar",
    "phone": "+27 84 344 2798",
    "address": {
      "line1": "92 Oxford Road, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.771947,
      "lng": 28.245097
    }
  },
  {
    "id": "cust-0035",
    "email": "jacques.naidoo35@example.co.za",
    "firstName": "Jacques",
    "lastName": "Naidoo",
    "phone": "+27 76 826 6569",
    "address": {
      "line1": "74 Lynnwood Road, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.992337,
      "lng": 28.118636
    }
  },
  {
    "id": "cust-0036",
    "email": "pieter.mokoena36@example.co.za",
    "firstName": "Pieter",
    "lastName": "Mokoena",
    "phone": "+27 84 108 2220",
    "address": {
      "line1": "172 Oxford Road, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.020261,
      "lng": 28.00127
    }
  },
  {
    "id": "cust-0037",
    "email": "hendrik.pretorius37@example.co.za",
    "firstName": "Hendrik",
    "lastName": "Pretorius",
    "phone": "+27 79 277 3306",
    "address": {
      "line1": "131 De Korte Street, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.748646,
      "lng": 28.245695
    }
  },
  {
    "id": "cust-0038",
    "email": "dineo.visser38@example.co.za",
    "firstName": "Dineo",
    "lastName": "Visser",
    "phone": "+27 83 590 6049",
    "address": {
      "line1": "228 Grant Avenue, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.766161,
      "lng": 28.23438
    }
  },
  {
    "id": "cust-0039",
    "email": "tumelo.matlala39@example.co.za",
    "firstName": "Tumelo",
    "lastName": "Matlala",
    "phone": "+27 83 368 6339",
    "address": {
      "line1": "25 William Nicol Drive, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.020706,
      "lng": 28.002708
    }
  },
  {
    "id": "cust-0040",
    "email": "farai.maharaj40@example.co.za",
    "firstName": "Farai",
    "lastName": "Maharaj",
    "phone": "+27 82 701 4730",
    "address": {
      "line1": "116 Charles Street, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.740264,
      "lng": 28.228553
    }
  },
  {
    "id": "cust-0041",
    "email": "jacques.zulu41@example.co.za",
    "firstName": "Jacques",
    "lastName": "Zulu",
    "phone": "+27 83 445 8446",
    "address": {
      "line1": "129 Church Street, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.852226,
      "lng": 28.188995
    }
  },
  {
    "id": "cust-0042",
    "email": "michael.gumede42@example.co.za",
    "firstName": "Michael",
    "lastName": "Gumede",
    "phone": "+27 83 920 3375",
    "address": {
      "line1": "174 William Nicol Drive, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.774381,
      "lng": 28.26846
    }
  },
  {
    "id": "cust-0043",
    "email": "dineo.mthembu43@example.co.za",
    "firstName": "Dineo",
    "lastName": "Mthembu",
    "phone": "+27 84 417 4072",
    "address": {
      "line1": "347 William Nicol Drive, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.016567,
      "lng": 28.001703
    }
  },
  {
    "id": "cust-0044",
    "email": "bongani.gumbo44@example.co.za",
    "firstName": "Bongani",
    "lastName": "Gumbo",
    "phone": "+27 84 991 1760",
    "address": {
      "line1": "75 Atterbury Road, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.166698,
      "lng": 28.016513
    }
  },
  {
    "id": "cust-0045",
    "email": "lerato.van.der.merwe45@example.co.za",
    "firstName": "Lerato",
    "lastName": "Van Der Merwe",
    "phone": "+27 82 564 8327",
    "address": {
      "line1": "19 Duncan Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.022151,
      "lng": 28.018361
    }
  },
  {
    "id": "cust-0046",
    "email": "karabo.barnardo46@example.co.za",
    "firstName": "Karabo",
    "lastName": "Barnardo",
    "phone": "+27 79 925 7330",
    "address": {
      "line1": "224 Church Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.015222,
      "lng": 28.013079
    }
  },
  {
    "id": "cust-0047",
    "email": "bulelwa.maharaj47@example.co.za",
    "firstName": "Bulelwa",
    "lastName": "Maharaj",
    "phone": "+27 84 130 9990",
    "address": {
      "line1": "367 Main Road, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.192444,
      "lng": 28.032168
    }
  },
  {
    "id": "cust-0048",
    "email": "gareth.moodley48@example.co.za",
    "firstName": "Gareth",
    "lastName": "Moodley",
    "phone": "+27 84 800 9197",
    "address": {
      "line1": "310 Charles Street, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.751985,
      "lng": 28.246543
    }
  },
  {
    "id": "cust-0049",
    "email": "brett.govender49@example.co.za",
    "firstName": "Brett",
    "lastName": "Govender",
    "phone": "+27 82 125 2505",
    "address": {
      "line1": "47 Fehrsen Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.007395,
      "lng": 28.008714
    }
  },
  {
    "id": "cust-0050",
    "email": "refilwe.fourie50@example.co.za",
    "firstName": "Refilwe",
    "lastName": "Fourie",
    "phone": "+27 82 260 3137",
    "address": {
      "line1": "405 Oxford Road, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.002031,
      "lng": 28.135393
    }
  },
  {
    "id": "cust-0051",
    "email": "simba.sibanda51@example.co.za",
    "firstName": "Simba",
    "lastName": "Sibanda",
    "phone": "+27 76 427 2982",
    "address": {
      "line1": "446 Grant Avenue, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.999649,
      "lng": 28.13544
    }
  },
  {
    "id": "cust-0052",
    "email": "preetha.fourie52@example.co.za",
    "firstName": "Preetha",
    "lastName": "Fourie",
    "phone": "+27 84 416 4596",
    "address": {
      "line1": "115 Fehrsen Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.141953,
      "lng": 28.008042
    }
  },
  {
    "id": "cust-0053",
    "email": "sunil.meyer53@example.co.za",
    "firstName": "Sunil",
    "lastName": "Meyer",
    "phone": "+27 79 181 5201",
    "address": {
      "line1": "39 Charles Street, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.761226,
      "lng": 28.241322
    }
  },
  {
    "id": "cust-0054",
    "email": "johan.coetzee54@example.co.za",
    "firstName": "Johan",
    "lastName": "Coetzee",
    "phone": "+27 76 946 4685",
    "address": {
      "line1": "279 7th Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.005709,
      "lng": 28.013785
    }
  },
  {
    "id": "cust-0055",
    "email": "nandi.naidoo55@example.co.za",
    "firstName": "Nandi",
    "lastName": "Naidoo",
    "phone": "+27 79 598 1604",
    "address": {
      "line1": "279 Lynnwood Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.150564,
      "lng": 28.036896
    }
  },
  {
    "id": "cust-0056",
    "email": "nandi.matlala56@example.co.za",
    "firstName": "Nandi",
    "lastName": "Matlala",
    "phone": "+27 76 495 4181",
    "address": {
      "line1": "18 Main Road, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.142094,
      "lng": 28.020288
    }
  },
  {
    "id": "cust-0057",
    "email": "annelize.gumede57@example.co.za",
    "firstName": "Annelize",
    "lastName": "Gumede",
    "phone": "+27 83 256 2304",
    "address": {
      "line1": "107 Oxford Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.145531,
      "lng": 28.044912
    }
  },
  {
    "id": "cust-0058",
    "email": "tumelo.van.der.merwe58@example.co.za",
    "firstName": "Tumelo",
    "lastName": "Van Der Merwe",
    "phone": "+27 79 373 8529",
    "address": {
      "line1": "389 Fehrsen Street, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.143293,
      "lng": 28.045309
    }
  },
  {
    "id": "cust-0059",
    "email": "zanele.moodley59@example.co.za",
    "firstName": "Zanele",
    "lastName": "Moodley",
    "phone": "+27 79 900 6078",
    "address": {
      "line1": "194 Oxford Road, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.152803,
      "lng": 28.074125
    }
  },
  {
    "id": "cust-0060",
    "email": "andile.robinson60@example.co.za",
    "firstName": "Andile",
    "lastName": "Robinson",
    "phone": "+27 79 759 1840",
    "address": {
      "line1": "231 7th Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.128984,
      "lng": 28.020353
    }
  }
];
