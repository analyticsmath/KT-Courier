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
    "email": "lerato.van der merwe45@example.co.za",
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
    "email": "tumelo.van der merwe58@example.co.za",
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
  },
  {
    "id": "cust-0061",
    "email": "hendrik.moodley61@example.co.za",
    "firstName": "Hendrik",
    "lastName": "Moodley",
    "phone": "+27 84 339 4371",
    "address": {
      "line1": "295 De Korte Street, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.850707,
      "lng": 28.199115
    }
  },
  {
    "id": "cust-0062",
    "email": "esme.robinson62@example.co.za",
    "firstName": "Esme",
    "lastName": "Robinson",
    "phone": "+27 84 196 7892",
    "address": {
      "line1": "415 Atterbury Road, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.12712,
      "lng": 28.016065
    }
  },
  {
    "id": "cust-0063",
    "email": "blessing.visser63@example.co.za",
    "firstName": "Blessing",
    "lastName": "Visser",
    "phone": "+27 83 353 9293",
    "address": {
      "line1": "51 Charles Street, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.104332,
      "lng": 28.053443
    }
  },
  {
    "id": "cust-0064",
    "email": "kagiso.daniels64@example.co.za",
    "firstName": "Kagiso",
    "lastName": "Daniels",
    "phone": "+27 76 197 4129",
    "address": {
      "line1": "297 4th Avenue, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.850473,
      "lng": 28.196046
    }
  },
  {
    "id": "cust-0065",
    "email": "ayanda.ross65@example.co.za",
    "firstName": "Ayanda",
    "lastName": "Ross",
    "phone": "+27 76 785 6622",
    "address": {
      "line1": "82 Grant Avenue, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.12991,
      "lng": 28.020342
    }
  },
  {
    "id": "cust-0066",
    "email": "zanele.adams66@example.co.za",
    "firstName": "Zanele",
    "lastName": "Adams",
    "phone": "+27 82 538 3662",
    "address": {
      "line1": "316 De Korte Street, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.174344,
      "lng": 28.003414
    }
  },
  {
    "id": "cust-0067",
    "email": "mandla.snyman67@example.co.za",
    "firstName": "Mandla",
    "lastName": "Snyman",
    "phone": "+27 76 546 4803",
    "address": {
      "line1": "245 Atterbury Road, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.001857,
      "lng": 28.134137
    }
  },
  {
    "id": "cust-0068",
    "email": "sunil.singh68@example.co.za",
    "firstName": "Sunil",
    "lastName": "Singh",
    "phone": "+27 76 565 8269",
    "address": {
      "line1": "395 Stanley Street, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.137842,
      "lng": 28.04469
    }
  },
  {
    "id": "cust-0069",
    "email": "kabelo.van der merwe69@example.co.za",
    "firstName": "Kabelo",
    "lastName": "Van Der Merwe",
    "phone": "+27 82 115 8948",
    "address": {
      "line1": "428 Jan Smuts Avenue, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.865885,
      "lng": 28.1855
    }
  },
  {
    "id": "cust-0070",
    "email": "lerato.reddy70@example.co.za",
    "firstName": "Lerato",
    "lastName": "Reddy",
    "phone": "+27 83 187 3395",
    "address": {
      "line1": "438 Sandton Drive, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.133327,
      "lng": 28.02352
    }
  },
  {
    "id": "cust-0071",
    "email": "zanele.hendricks71@example.co.za",
    "firstName": "Zanele",
    "lastName": "Hendricks",
    "phone": "+27 76 136 9833",
    "address": {
      "line1": "304 Lynnwood Road, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.991381,
      "lng": 28.117741
    }
  },
  {
    "id": "cust-0072",
    "email": "esme.gumede72@example.co.za",
    "firstName": "Esme",
    "lastName": "Gumede",
    "phone": "+27 76 584 4150",
    "address": {
      "line1": "235 De Korte Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.140023,
      "lng": 28.025734
    }
  },
  {
    "id": "cust-0073",
    "email": "sipho.mthembu73@example.co.za",
    "firstName": "Sipho",
    "lastName": "Mthembu",
    "phone": "+27 72 620 5903",
    "address": {
      "line1": "278 Atterbury Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.143048,
      "lng": 28.03793
    }
  },
  {
    "id": "cust-0074",
    "email": "puleng.phiri74@example.co.za",
    "firstName": "Puleng",
    "lastName": "Phiri",
    "phone": "+27 76 999 8313",
    "address": {
      "line1": "108 Rivonia Road, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.139393,
      "lng": 28.01873
    }
  },
  {
    "id": "cust-0075",
    "email": "andile.nel75@example.co.za",
    "firstName": "Andile",
    "lastName": "Nel",
    "phone": "+27 79 745 4269",
    "address": {
      "line1": "38 4th Avenue, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.155423,
      "lng": 28.08525
    }
  },
  {
    "id": "cust-0076",
    "email": "sophie.ncube76@example.co.za",
    "firstName": "Sophie",
    "lastName": "Ncube",
    "phone": "+27 72 644 9328",
    "address": {
      "line1": "63 Main Road, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.183988,
      "lng": 28.020798
    }
  },
  {
    "id": "cust-0077",
    "email": "sipho.reddy77@example.co.za",
    "firstName": "Sipho",
    "lastName": "Reddy",
    "phone": "+27 83 154 9710",
    "address": {
      "line1": "109 Duncan Street, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.779847,
      "lng": 28.243688
    }
  },
  {
    "id": "cust-0078",
    "email": "itumeleng.naidoo78@example.co.za",
    "firstName": "Itumeleng",
    "lastName": "Naidoo",
    "phone": "+27 83 297 6305",
    "address": {
      "line1": "137 Atterbury Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.146053,
      "lng": 28.04868
    }
  },
  {
    "id": "cust-0079",
    "email": "johan.chetty79@example.co.za",
    "firstName": "Johan",
    "lastName": "Chetty",
    "phone": "+27 79 861 1669",
    "address": {
      "line1": "94 William Nicol Drive, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.003514,
      "lng": 28.12816
    }
  },
  {
    "id": "cust-0080",
    "email": "zanele.du randt80@example.co.za",
    "firstName": "Zanele",
    "lastName": "Du Randt",
    "phone": "+27 82 901 2024",
    "address": {
      "line1": "155 Sandton Drive, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.746608,
      "lng": 28.240151
    }
  },
  {
    "id": "cust-0081",
    "email": "marike.khumalo81@example.co.za",
    "firstName": "Marike",
    "lastName": "Khumalo",
    "phone": "+27 83 741 7258",
    "address": {
      "line1": "382 William Nicol Drive, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.74188,
      "lng": 28.237358
    }
  },
  {
    "id": "cust-0082",
    "email": "reneilwe.govender82@example.co.za",
    "firstName": "Reneilwe",
    "lastName": "Govender",
    "phone": "+27 83 968 6927",
    "address": {
      "line1": "220 De Korte Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.020191,
      "lng": 28.015147
    }
  },
  {
    "id": "cust-0083",
    "email": "sophie.gumbo83@example.co.za",
    "firstName": "Sophie",
    "lastName": "Gumbo",
    "phone": "+27 76 239 9254",
    "address": {
      "line1": "97 Jan Smuts Avenue, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.139943,
      "lng": 28.04015
    }
  },
  {
    "id": "cust-0084",
    "email": "tanya.adams84@example.co.za",
    "firstName": "Tanya",
    "lastName": "Adams",
    "phone": "+27 72 876 4127",
    "address": {
      "line1": "173 De Korte Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.157869,
      "lng": 28.075118
    }
  },
  {
    "id": "cust-0085",
    "email": "itumeleng.zulu85@example.co.za",
    "firstName": "Itumeleng",
    "lastName": "Zulu",
    "phone": "+27 83 668 4102",
    "address": {
      "line1": "293 Rivonia Road, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.107986,
      "lng": 28.047793
    }
  },
  {
    "id": "cust-0086",
    "email": "jabulani.steyn86@example.co.za",
    "firstName": "Jabulani",
    "lastName": "Steyn",
    "phone": "+27 79 569 1401",
    "address": {
      "line1": "235 Sandton Drive, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.114719,
      "lng": 28.04712
    }
  },
  {
    "id": "cust-0087",
    "email": "mandla.reddy87@example.co.za",
    "firstName": "Mandla",
    "lastName": "Reddy",
    "phone": "+27 83 403 2913",
    "address": {
      "line1": "260 Rivonia Road, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.152388,
      "lng": 28.073593
    }
  },
  {
    "id": "cust-0088",
    "email": "kudzai.pretorius88@example.co.za",
    "firstName": "Kudzai",
    "lastName": "Pretorius",
    "phone": "+27 72 559 8193",
    "address": {
      "line1": "162 Main Road, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.777767,
      "lng": 28.270732
    }
  },
  {
    "id": "cust-0089",
    "email": "marike.ross89@example.co.za",
    "firstName": "Marike",
    "lastName": "Ross",
    "phone": "+27 83 691 2465",
    "address": {
      "line1": "419 Juta Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.195402,
      "lng": 28.021494
    }
  },
  {
    "id": "cust-0090",
    "email": "preetha.zuma90@example.co.za",
    "firstName": "Preetha",
    "lastName": "Zuma",
    "phone": "+27 84 822 9616",
    "address": {
      "line1": "42 Charles Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.016604,
      "lng": 28.018816
    }
  },
  {
    "id": "cust-0091",
    "email": "katlego.padayachee91@example.co.za",
    "firstName": "Katlego",
    "lastName": "Padayachee",
    "phone": "+27 79 342 7202",
    "address": {
      "line1": "126 Main Road, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.7675,
      "lng": 28.226797
    }
  },
  {
    "id": "cust-0092",
    "email": "kudzai.moodley92@example.co.za",
    "firstName": "Kudzai",
    "lastName": "Moodley",
    "phone": "+27 72 304 9445",
    "address": {
      "line1": "48 Atterbury Road, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.78976,
      "lng": 28.268904
    }
  },
  {
    "id": "cust-0093",
    "email": "blessing.gumede93@example.co.za",
    "firstName": "Blessing",
    "lastName": "Gumede",
    "phone": "+27 83 933 3235",
    "address": {
      "line1": "270 Jan Smuts Avenue, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.113782,
      "lng": 28.062821
    }
  },
  {
    "id": "cust-0094",
    "email": "zola.sibanda94@example.co.za",
    "firstName": "Zola",
    "lastName": "Sibanda",
    "phone": "+27 79 616 7126",
    "address": {
      "line1": "36 Church Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.989751,
      "lng": 28.116521
    }
  },
  {
    "id": "cust-0095",
    "email": "mpho.gumede95@example.co.za",
    "firstName": "Mpho",
    "lastName": "Gumede",
    "phone": "+27 84 909 1342",
    "address": {
      "line1": "324 Jan Smuts Avenue, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.778258,
      "lng": 28.227685
    }
  },
  {
    "id": "cust-0096",
    "email": "helena.reddy96@example.co.za",
    "firstName": "Helena",
    "lastName": "Reddy",
    "phone": "+27 82 435 7771",
    "address": {
      "line1": "344 Stanley Street, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.85489,
      "lng": 28.19344
    }
  },
  {
    "id": "cust-0097",
    "email": "marike.molefe97@example.co.za",
    "firstName": "Marike",
    "lastName": "Molefe",
    "phone": "+27 83 182 4968",
    "address": {
      "line1": "192 William Nicol Drive, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.142887,
      "lng": 28.024238
    }
  },
  {
    "id": "cust-0098",
    "email": "johan.singh98@example.co.za",
    "firstName": "Johan",
    "lastName": "Singh",
    "phone": "+27 84 406 2156",
    "address": {
      "line1": "195 Atterbury Road, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.146163,
      "lng": 28.01517
    }
  },
  {
    "id": "cust-0099",
    "email": "michael.steyn99@example.co.za",
    "firstName": "Michael",
    "lastName": "Steyn",
    "phone": "+27 76 829 2223",
    "address": {
      "line1": "114 Church Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.187194,
      "lng": 28.025607
    }
  },
  {
    "id": "cust-0100",
    "email": "anisha.matlala100@example.co.za",
    "firstName": "Anisha",
    "lastName": "Matlala",
    "phone": "+27 84 540 6726",
    "address": {
      "line1": "444 Charles Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.201375,
      "lng": 28.025881
    }
  },
  {
    "id": "cust-0101",
    "email": "ayanda.van der merwe101@example.co.za",
    "firstName": "Ayanda",
    "lastName": "Van Der Merwe",
    "phone": "+27 83 294 8886",
    "address": {
      "line1": "412 Rivonia Road, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.861743,
      "lng": 28.196392
    }
  },
  {
    "id": "cust-0102",
    "email": "sophie.chetty102@example.co.za",
    "firstName": "Sophie",
    "lastName": "Chetty",
    "phone": "+27 76 914 1592",
    "address": {
      "line1": "330 Fehrsen Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.128361,
      "lng": 28.009556
    }
  },
  {
    "id": "cust-0103",
    "email": "annelize.sithole103@example.co.za",
    "firstName": "Annelize",
    "lastName": "Sithole",
    "phone": "+27 84 489 9401",
    "address": {
      "line1": "191 Main Road, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.775082,
      "lng": 28.243783
    }
  },
  {
    "id": "cust-0104",
    "email": "zanele.barnardo104@example.co.za",
    "firstName": "Zanele",
    "lastName": "Barnardo",
    "phone": "+27 76 274 9533",
    "address": {
      "line1": "375 Lynnwood Road, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.145263,
      "lng": 28.007984
    }
  },
  {
    "id": "cust-0105",
    "email": "craig.pillay105@example.co.za",
    "firstName": "Craig",
    "lastName": "Pillay",
    "phone": "+27 79 392 2878",
    "address": {
      "line1": "391 Rivonia Road, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.765358,
      "lng": 28.22612
    }
  },
  {
    "id": "cust-0106",
    "email": "simba.adams106@example.co.za",
    "firstName": "Simba",
    "lastName": "Adams",
    "phone": "+27 76 630 9992",
    "address": {
      "line1": "185 Sandton Drive, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.175174,
      "lng": 28.004477
    }
  },
  {
    "id": "cust-0107",
    "email": "sipho.van der merwe107@example.co.za",
    "firstName": "Sipho",
    "lastName": "Van Der Merwe",
    "phone": "+27 84 946 1097",
    "address": {
      "line1": "384 4th Avenue, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.135091,
      "lng": 28.02078
    }
  },
  {
    "id": "cust-0108",
    "email": "puleng.snyman108@example.co.za",
    "firstName": "Puleng",
    "lastName": "Snyman",
    "phone": "+27 79 760 3081",
    "address": {
      "line1": "148 Oxford Road, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.022051,
      "lng": 28.011332
    }
  },
  {
    "id": "cust-0109",
    "email": "tumelo.matlala109@example.co.za",
    "firstName": "Tumelo",
    "lastName": "Matlala",
    "phone": "+27 79 663 5500",
    "address": {
      "line1": "274 Oxford Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.148018,
      "lng": 28.039998
    }
  },
  {
    "id": "cust-0110",
    "email": "nomsa.grobbelaar110@example.co.za",
    "firstName": "Nomsa",
    "lastName": "Grobbelaar",
    "phone": "+27 82 209 7577",
    "address": {
      "line1": "288 Fehrsen Street, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.105192,
      "lng": 28.055412
    }
  },
  {
    "id": "cust-0111",
    "email": "puleng.matlala111@example.co.za",
    "firstName": "Puleng",
    "lastName": "Matlala",
    "phone": "+27 83 821 8200",
    "address": {
      "line1": "352 Main Road, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.782207,
      "lng": 28.272825
    }
  },
  {
    "id": "cust-0112",
    "email": "itumeleng.pretorius112@example.co.za",
    "firstName": "Itumeleng",
    "lastName": "Pretorius",
    "phone": "+27 79 288 1925",
    "address": {
      "line1": "309 Oxford Road, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.78108,
      "lng": 28.278777
    }
  },
  {
    "id": "cust-0113",
    "email": "keabetswe.singh113@example.co.za",
    "firstName": "Keabetswe",
    "lastName": "Singh",
    "phone": "+27 82 464 7974",
    "address": {
      "line1": "389 Juta Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.148035,
      "lng": 28.086116
    }
  },
  {
    "id": "cust-0114",
    "email": "puleng.visser114@example.co.za",
    "firstName": "Puleng",
    "lastName": "Visser",
    "phone": "+27 76 273 6236",
    "address": {
      "line1": "401 Duncan Street, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.745293,
      "lng": 28.232433
    }
  },
  {
    "id": "cust-0115",
    "email": "rajesh.naidoo115@example.co.za",
    "firstName": "Rajesh",
    "lastName": "Naidoo",
    "phone": "+27 82 104 5266",
    "address": {
      "line1": "140 De Korte Street, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.102127,
      "lng": 28.06285
    }
  },
  {
    "id": "cust-0116",
    "email": "neo.claassen116@example.co.za",
    "firstName": "Neo",
    "lastName": "Claassen",
    "phone": "+27 84 511 8288",
    "address": {
      "line1": "85 Duncan Street, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.155085,
      "lng": 28.049422
    }
  },
  {
    "id": "cust-0117",
    "email": "tanya.pillay117@example.co.za",
    "firstName": "Tanya",
    "lastName": "Pillay",
    "phone": "+27 79 617 3188",
    "address": {
      "line1": "146 Oxford Road, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.752775,
      "lng": 28.242389
    }
  },
  {
    "id": "cust-0118",
    "email": "esme.ncube118@example.co.za",
    "firstName": "Esme",
    "lastName": "Ncube",
    "phone": "+27 83 711 3524",
    "address": {
      "line1": "67 Jan Smuts Avenue, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.143427,
      "lng": 28.041348
    }
  },
  {
    "id": "cust-0119",
    "email": "tanya.chetty119@example.co.za",
    "firstName": "Tanya",
    "lastName": "Chetty",
    "phone": "+27 72 949 5518",
    "address": {
      "line1": "127 7th Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.778209,
      "lng": 28.284066
    }
  },
  {
    "id": "cust-0120",
    "email": "bulelwa.adams120@example.co.za",
    "firstName": "Bulelwa",
    "lastName": "Adams",
    "phone": "+27 72 653 5058",
    "address": {
      "line1": "336 4th Avenue, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.86882,
      "lng": 28.190127
    }
  },
  {
    "id": "cust-0121",
    "email": "christo.singh121@example.co.za",
    "firstName": "Christo",
    "lastName": "Singh",
    "phone": "+27 83 911 2699",
    "address": {
      "line1": "390 Grant Avenue, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.777044,
      "lng": 28.272906
    }
  },
  {
    "id": "cust-0122",
    "email": "michael.mokoena122@example.co.za",
    "firstName": "Michael",
    "lastName": "Mokoena",
    "phone": "+27 83 579 5665",
    "address": {
      "line1": "365 William Nicol Drive, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.857573,
      "lng": 28.194481
    }
  },
  {
    "id": "cust-0123",
    "email": "esme.dlamini123@example.co.za",
    "firstName": "Esme",
    "lastName": "Dlamini",
    "phone": "+27 84 980 8844",
    "address": {
      "line1": "373 Church Street, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.748294,
      "lng": 28.23508
    }
  },
  {
    "id": "cust-0124",
    "email": "zola.snyman124@example.co.za",
    "firstName": "Zola",
    "lastName": "Snyman",
    "phone": "+27 84 402 8791",
    "address": {
      "line1": "58 Stanley Street, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.098647,
      "lng": 28.049756
    }
  },
  {
    "id": "cust-0125",
    "email": "gareth.fourie125@example.co.za",
    "firstName": "Gareth",
    "lastName": "Fourie",
    "phone": "+27 83 901 5729",
    "address": {
      "line1": "198 Jan Smuts Avenue, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.784345,
      "lng": 28.265399
    }
  },
  {
    "id": "cust-0126",
    "email": "zola.claassen126@example.co.za",
    "firstName": "Zola",
    "lastName": "Claassen",
    "phone": "+27 79 399 2546",
    "address": {
      "line1": "105 Church Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.136365,
      "lng": 28.02328
    }
  },
  {
    "id": "cust-0127",
    "email": "boitumelo.pillay127@example.co.za",
    "firstName": "Boitumelo",
    "lastName": "Pillay",
    "phone": "+27 72 685 9799",
    "address": {
      "line1": "272 Juta Street, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.140502,
      "lng": 28.041032
    }
  },
  {
    "id": "cust-0128",
    "email": "blessing.robinson128@example.co.za",
    "firstName": "Blessing",
    "lastName": "Robinson",
    "phone": "+27 82 714 2709",
    "address": {
      "line1": "378 Lynnwood Road, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.150692,
      "lng": 28.074354
    }
  },
  {
    "id": "cust-0129",
    "email": "nandi.claassen129@example.co.za",
    "firstName": "Nandi",
    "lastName": "Claassen",
    "phone": "+27 79 409 1165",
    "address": {
      "line1": "283 Charles Street, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.174799,
      "lng": 28.009163
    }
  },
  {
    "id": "cust-0130",
    "email": "karabo.gxilishe130@example.co.za",
    "firstName": "Karabo",
    "lastName": "Gxilishe",
    "phone": "+27 84 559 2724",
    "address": {
      "line1": "432 Charles Street, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.741576,
      "lng": 28.228167
    }
  },
  {
    "id": "cust-0131",
    "email": "preetha.singh131@example.co.za",
    "firstName": "Preetha",
    "lastName": "Singh",
    "phone": "+27 84 619 2606",
    "address": {
      "line1": "303 Fehrsen Street, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.753679,
      "lng": 28.237679
    }
  },
  {
    "id": "cust-0132",
    "email": "nthabiseng.zuma132@example.co.za",
    "firstName": "Nthabiseng",
    "lastName": "Zuma",
    "phone": "+27 79 711 1701",
    "address": {
      "line1": "307 De Korte Street, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.774363,
      "lng": 28.23406
    }
  },
  {
    "id": "cust-0133",
    "email": "etienne.steyn133@example.co.za",
    "firstName": "Etienne",
    "lastName": "Steyn",
    "phone": "+27 72 625 2565",
    "address": {
      "line1": "388 William Nicol Drive, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.184734,
      "lng": 28.005195
    }
  },
  {
    "id": "cust-0134",
    "email": "pieter.adams134@example.co.za",
    "firstName": "Pieter",
    "lastName": "Adams",
    "phone": "+27 82 316 2420",
    "address": {
      "line1": "275 Rivonia Road, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.766573,
      "lng": 28.226808
    }
  },
  {
    "id": "cust-0135",
    "email": "sibusiso.zulu135@example.co.za",
    "firstName": "Sibusiso",
    "lastName": "Zulu",
    "phone": "+27 76 105 1154",
    "address": {
      "line1": "27 Charles Street, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.106122,
      "lng": 28.063505
    }
  },
  {
    "id": "cust-0136",
    "email": "willem.gumede136@example.co.za",
    "firstName": "Willem",
    "lastName": "Gumede",
    "phone": "+27 79 583 6323",
    "address": {
      "line1": "440 Jan Smuts Avenue, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.776244,
      "lng": 28.272749
    }
  },
  {
    "id": "cust-0137",
    "email": "brett.fourie137@example.co.za",
    "firstName": "Brett",
    "lastName": "Fourie",
    "phone": "+27 72 404 8150",
    "address": {
      "line1": "142 Stanley Street, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.745741,
      "lng": 28.241974
    }
  },
  {
    "id": "cust-0138",
    "email": "bulelwa.adams138@example.co.za",
    "firstName": "Bulelwa",
    "lastName": "Adams",
    "phone": "+27 82 991 5523",
    "address": {
      "line1": "193 4th Avenue, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.762845,
      "lng": 28.238231
    }
  },
  {
    "id": "cust-0139",
    "email": "karabo.phiri139@example.co.za",
    "firstName": "Karabo",
    "lastName": "Phiri",
    "phone": "+27 72 132 1998",
    "address": {
      "line1": "438 Oxford Road, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.851473,
      "lng": 28.190262
    }
  },
  {
    "id": "cust-0140",
    "email": "marike.du randt140@example.co.za",
    "firstName": "Marike",
    "lastName": "Du Randt",
    "phone": "+27 72 584 7797",
    "address": {
      "line1": "205 Jan Smuts Avenue, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.74205,
      "lng": 28.230511
    }
  },
  {
    "id": "cust-0141",
    "email": "blessing.pretorius141@example.co.za",
    "firstName": "Blessing",
    "lastName": "Pretorius",
    "phone": "+27 84 368 2809",
    "address": {
      "line1": "204 7th Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.007998,
      "lng": 28.123573
    }
  },
  {
    "id": "cust-0142",
    "email": "helena.phiri142@example.co.za",
    "firstName": "Helena",
    "lastName": "Phiri",
    "phone": "+27 76 773 4589",
    "address": {
      "line1": "231 Jan Smuts Avenue, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.201987,
      "lng": 28.032367
    }
  },
  {
    "id": "cust-0143",
    "email": "sizwe.zulu143@example.co.za",
    "firstName": "Sizwe",
    "lastName": "Zulu",
    "phone": "+27 76 556 7360",
    "address": {
      "line1": "313 Main Road, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.146867,
      "lng": 28.086851
    }
  },
  {
    "id": "cust-0144",
    "email": "kefilwe.steyn144@example.co.za",
    "firstName": "Kefilwe",
    "lastName": "Steyn",
    "phone": "+27 72 637 8011",
    "address": {
      "line1": "362 William Nicol Drive, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.012946,
      "lng": 28.016362
    }
  },
  {
    "id": "cust-0145",
    "email": "zanele.meyer145@example.co.za",
    "firstName": "Zanele",
    "lastName": "Meyer",
    "phone": "+27 79 406 2097",
    "address": {
      "line1": "121 Stanley Street, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.764953,
      "lng": 28.229899
    }
  },
  {
    "id": "cust-0146",
    "email": "boitumelo.gxilishe146@example.co.za",
    "firstName": "Boitumelo",
    "lastName": "Gxilishe",
    "phone": "+27 79 919 3841",
    "address": {
      "line1": "318 Jan Smuts Avenue, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.135258,
      "lng": 28.025828
    }
  },
  {
    "id": "cust-0147",
    "email": "reneilwe.gumbo147@example.co.za",
    "firstName": "Reneilwe",
    "lastName": "Gumbo",
    "phone": "+27 83 597 9131",
    "address": {
      "line1": "65 Lynnwood Road, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.142258,
      "lng": 28.017234
    }
  },
  {
    "id": "cust-0148",
    "email": "christo.zuma148@example.co.za",
    "firstName": "Christo",
    "lastName": "Zuma",
    "phone": "+27 76 531 9522",
    "address": {
      "line1": "406 De Korte Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.147938,
      "lng": 28.08719
    }
  },
  {
    "id": "cust-0149",
    "email": "helena.van der merwe149@example.co.za",
    "firstName": "Helena",
    "lastName": "Van Der Merwe",
    "phone": "+27 72 474 3238",
    "address": {
      "line1": "68 De Korte Street, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.752089,
      "lng": 28.241676
    }
  },
  {
    "id": "cust-0150",
    "email": "stephan.daniels150@example.co.za",
    "firstName": "Stephan",
    "lastName": "Daniels",
    "phone": "+27 79 850 3166",
    "address": {
      "line1": "64 7th Street, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.105199,
      "lng": 28.051619
    }
  },
  {
    "id": "cust-0151",
    "email": "thabo.dlamini151@example.co.za",
    "firstName": "Thabo",
    "lastName": "Dlamini",
    "phone": "+27 79 847 5864",
    "address": {
      "line1": "37 William Nicol Drive, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.761708,
      "lng": 28.239873
    }
  },
  {
    "id": "cust-0152",
    "email": "marike.govender152@example.co.za",
    "firstName": "Marike",
    "lastName": "Govender",
    "phone": "+27 84 721 2551",
    "address": {
      "line1": "315 Duncan Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.201228,
      "lng": 28.037427
    }
  },
  {
    "id": "cust-0153",
    "email": "priya.singh153@example.co.za",
    "firstName": "Priya",
    "lastName": "Singh",
    "phone": "+27 83 193 5119",
    "address": {
      "line1": "209 De Korte Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.999037,
      "lng": 28.128954
    }
  },
  {
    "id": "cust-0154",
    "email": "stephan.pillay154@example.co.za",
    "firstName": "Stephan",
    "lastName": "Pillay",
    "phone": "+27 82 154 6122",
    "address": {
      "line1": "213 Duncan Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.151729,
      "lng": 28.085683
    }
  },
  {
    "id": "cust-0155",
    "email": "tanya.snyman155@example.co.za",
    "firstName": "Tanya",
    "lastName": "Snyman",
    "phone": "+27 82 459 7782",
    "address": {
      "line1": "7 Juta Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.159141,
      "lng": 28.069516
    }
  },
  {
    "id": "cust-0156",
    "email": "david.chetty156@example.co.za",
    "firstName": "David",
    "lastName": "Chetty",
    "phone": "+27 83 129 2988",
    "address": {
      "line1": "349 Church Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.015837,
      "lng": 28.007669
    }
  },
  {
    "id": "cust-0157",
    "email": "kabelo.sibanda157@example.co.za",
    "firstName": "Kabelo",
    "lastName": "Sibanda",
    "phone": "+27 76 854 7296",
    "address": {
      "line1": "336 4th Avenue, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.140569,
      "lng": 28.039051
    }
  },
  {
    "id": "cust-0158",
    "email": "kudzai.pillay158@example.co.za",
    "firstName": "Kudzai",
    "lastName": "Pillay",
    "phone": "+27 84 289 6929",
    "address": {
      "line1": "345 7th Street, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.765194,
      "lng": 28.229175
    }
  },
  {
    "id": "cust-0159",
    "email": "sipho.du plessis159@example.co.za",
    "firstName": "Sipho",
    "lastName": "Du Plessis",
    "phone": "+27 83 356 2774",
    "address": {
      "line1": "336 4th Avenue, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.200167,
      "lng": 28.021399
    }
  },
  {
    "id": "cust-0160",
    "email": "lindiwe.van der merwe160@example.co.za",
    "firstName": "Lindiwe",
    "lastName": "Van Der Merwe",
    "phone": "+27 79 845 6388",
    "address": {
      "line1": "255 Stanley Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.149594,
      "lng": 28.081212
    }
  },
  {
    "id": "cust-0161",
    "email": "itumeleng.ncube161@example.co.za",
    "firstName": "Itumeleng",
    "lastName": "Ncube",
    "phone": "+27 79 810 5992",
    "address": {
      "line1": "278 Atterbury Road, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.005655,
      "lng": 28.128837
    }
  },
  {
    "id": "cust-0162",
    "email": "ayanda.ncube162@example.co.za",
    "firstName": "Ayanda",
    "lastName": "Ncube",
    "phone": "+27 79 575 1477",
    "address": {
      "line1": "18 Charles Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.018394,
      "lng": 28.008878
    }
  },
  {
    "id": "cust-0163",
    "email": "christo.snyman163@example.co.za",
    "firstName": "Christo",
    "lastName": "Snyman",
    "phone": "+27 79 728 9396",
    "address": {
      "line1": "269 Rivonia Road, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.192571,
      "lng": 28.032
    }
  },
  {
    "id": "cust-0164",
    "email": "bongani.molefe164@example.co.za",
    "firstName": "Bongani",
    "lastName": "Molefe",
    "phone": "+27 83 824 1973",
    "address": {
      "line1": "108 Juta Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.00789,
      "lng": 28.120336
    }
  },
  {
    "id": "cust-0165",
    "email": "preetha.mthembu165@example.co.za",
    "firstName": "Preetha",
    "lastName": "Mthembu",
    "phone": "+27 82 486 5096",
    "address": {
      "line1": "146 De Korte Street, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.748783,
      "lng": 28.229838
    }
  },
  {
    "id": "cust-0166",
    "email": "simba.govender166@example.co.za",
    "firstName": "Simba",
    "lastName": "Govender",
    "phone": "+27 76 202 4321",
    "address": {
      "line1": "229 4th Avenue, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.859367,
      "lng": 28.192646
    }
  },
  {
    "id": "cust-0167",
    "email": "francois.padayachee167@example.co.za",
    "firstName": "Francois",
    "lastName": "Padayachee",
    "phone": "+27 83 929 9870",
    "address": {
      "line1": "133 4th Avenue, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.021666,
      "lng": 28.011706
    }
  },
  {
    "id": "cust-0168",
    "email": "claire.ncube168@example.co.za",
    "firstName": "Claire",
    "lastName": "Ncube",
    "phone": "+27 84 688 1632",
    "address": {
      "line1": "120 Juta Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.997002,
      "lng": 28.131513
    }
  },
  {
    "id": "cust-0169",
    "email": "dineo.nel169@example.co.za",
    "firstName": "Dineo",
    "lastName": "Nel",
    "phone": "+27 76 768 6162",
    "address": {
      "line1": "435 De Korte Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.191548,
      "lng": 28.033085
    }
  },
  {
    "id": "cust-0170",
    "email": "christo.zuma170@example.co.za",
    "firstName": "Christo",
    "lastName": "Zuma",
    "phone": "+27 84 825 8683",
    "address": {
      "line1": "205 Duncan Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.200749,
      "lng": 28.02698
    }
  },
  {
    "id": "cust-0171",
    "email": "neo.padayachee171@example.co.za",
    "firstName": "Neo",
    "lastName": "Padayachee",
    "phone": "+27 72 882 6084",
    "address": {
      "line1": "240 4th Avenue, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.165218,
      "lng": 28.069036
    }
  },
  {
    "id": "cust-0172",
    "email": "dineo.fourie172@example.co.za",
    "firstName": "Dineo",
    "lastName": "Fourie",
    "phone": "+27 79 326 2920",
    "address": {
      "line1": "287 Church Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.00348,
      "lng": 28.11915
    }
  },
  {
    "id": "cust-0173",
    "email": "zanele.gumede173@example.co.za",
    "firstName": "Zanele",
    "lastName": "Gumede",
    "phone": "+27 84 214 4414",
    "address": {
      "line1": "172 Jan Smuts Avenue, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.857607,
      "lng": 28.18349
    }
  },
  {
    "id": "cust-0174",
    "email": "esme.miller174@example.co.za",
    "firstName": "Esme",
    "lastName": "Miller",
    "phone": "+27 82 767 6453",
    "address": {
      "line1": "356 7th Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.191096,
      "lng": 28.03544
    }
  },
  {
    "id": "cust-0175",
    "email": "bongani.zulu175@example.co.za",
    "firstName": "Bongani",
    "lastName": "Zulu",
    "phone": "+27 72 375 9595",
    "address": {
      "line1": "84 Juta Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.141431,
      "lng": 28.024274
    }
  },
  {
    "id": "cust-0176",
    "email": "thabo.sibanda176@example.co.za",
    "firstName": "Thabo",
    "lastName": "Sibanda",
    "phone": "+27 79 594 3061",
    "address": {
      "line1": "335 Juta Street, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.178005,
      "lng": 28.013971
    }
  },
  {
    "id": "cust-0177",
    "email": "willem.meyer177@example.co.za",
    "firstName": "Willem",
    "lastName": "Meyer",
    "phone": "+27 72 944 8739",
    "address": {
      "line1": "318 Stanley Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.184504,
      "lng": 28.028359
    }
  },
  {
    "id": "cust-0178",
    "email": "claire.steyn178@example.co.za",
    "firstName": "Claire",
    "lastName": "Steyn",
    "phone": "+27 72 616 5186",
    "address": {
      "line1": "128 Sandton Drive, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.160968,
      "lng": 28.076691
    }
  },
  {
    "id": "cust-0179",
    "email": "boitumelo.phiri179@example.co.za",
    "firstName": "Boitumelo",
    "lastName": "Phiri",
    "phone": "+27 76 765 1624",
    "address": {
      "line1": "93 William Nicol Drive, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.09771,
      "lng": 28.065456
    }
  },
  {
    "id": "cust-0180",
    "email": "hendrik.moodley180@example.co.za",
    "firstName": "Hendrik",
    "lastName": "Moodley",
    "phone": "+27 79 213 9942",
    "address": {
      "line1": "425 Duncan Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.132708,
      "lng": 28.020827
    }
  },
  {
    "id": "cust-0181",
    "email": "jan.gxilishe181@example.co.za",
    "firstName": "Jan",
    "lastName": "Gxilishe",
    "phone": "+27 72 749 4695",
    "address": {
      "line1": "267 Grant Avenue, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.185056,
      "lng": 28.033034
    }
  },
  {
    "id": "cust-0182",
    "email": "boitumelo.mthembu182@example.co.za",
    "firstName": "Boitumelo",
    "lastName": "Mthembu",
    "phone": "+27 84 429 6105",
    "address": {
      "line1": "198 Stanley Street, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.86709,
      "lng": 28.181878
    }
  },
  {
    "id": "cust-0183",
    "email": "bulelwa.pretorius183@example.co.za",
    "firstName": "Bulelwa",
    "lastName": "Pretorius",
    "phone": "+27 76 974 7061",
    "address": {
      "line1": "78 Rivonia Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.144775,
      "lng": 28.038076
    }
  },
  {
    "id": "cust-0184",
    "email": "kabelo.adams184@example.co.za",
    "firstName": "Kabelo",
    "lastName": "Adams",
    "phone": "+27 84 474 5119",
    "address": {
      "line1": "352 Church Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.991063,
      "lng": 28.136135
    }
  },
  {
    "id": "cust-0185",
    "email": "itumeleng.padayachee185@example.co.za",
    "firstName": "Itumeleng",
    "lastName": "Padayachee",
    "phone": "+27 72 184 4502",
    "address": {
      "line1": "48 Church Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.78201,
      "lng": 28.26687
    }
  },
  {
    "id": "cust-0186",
    "email": "willem.dlamini186@example.co.za",
    "firstName": "Willem",
    "lastName": "Dlamini",
    "phone": "+27 76 226 6097",
    "address": {
      "line1": "27 Main Road, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.162072,
      "lng": 28.086039
    }
  },
  {
    "id": "cust-0187",
    "email": "blessing.pretorius187@example.co.za",
    "firstName": "Blessing",
    "lastName": "Pretorius",
    "phone": "+27 84 390 3461",
    "address": {
      "line1": "233 William Nicol Drive, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.743054,
      "lng": 28.23283
    }
  },
  {
    "id": "cust-0188",
    "email": "keabetswe.gumbo188@example.co.za",
    "firstName": "Keabetswe",
    "lastName": "Gumbo",
    "phone": "+27 82 630 2815",
    "address": {
      "line1": "394 7th Street, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.854338,
      "lng": 28.188766
    }
  },
  {
    "id": "cust-0189",
    "email": "refilwe.coetzee189@example.co.za",
    "firstName": "Refilwe",
    "lastName": "Coetzee",
    "phone": "+27 84 370 4050",
    "address": {
      "line1": "122 Oxford Road, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.787665,
      "lng": 28.269651
    }
  },
  {
    "id": "cust-0190",
    "email": "kabelo.snyman190@example.co.za",
    "firstName": "Kabelo",
    "lastName": "Snyman",
    "phone": "+27 84 197 5719",
    "address": {
      "line1": "210 Stanley Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.156698,
      "lng": 28.06775
    }
  },
  {
    "id": "cust-0191",
    "email": "craig.mokoena191@example.co.za",
    "firstName": "Craig",
    "lastName": "Mokoena",
    "phone": "+27 84 569 7046",
    "address": {
      "line1": "187 Duncan Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.996339,
      "lng": 28.135498
    }
  },
  {
    "id": "cust-0192",
    "email": "helena.miller192@example.co.za",
    "firstName": "Helena",
    "lastName": "Miller",
    "phone": "+27 84 205 6919",
    "address": {
      "line1": "213 Rivonia Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.147221,
      "lng": 28.047944
    }
  },
  {
    "id": "cust-0193",
    "email": "michael.nel193@example.co.za",
    "firstName": "Michael",
    "lastName": "Nel",
    "phone": "+27 82 497 8894",
    "address": {
      "line1": "133 Duncan Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.78476,
      "lng": 28.26593
    }
  },
  {
    "id": "cust-0194",
    "email": "priya.moodley194@example.co.za",
    "firstName": "Priya",
    "lastName": "Moodley",
    "phone": "+27 83 599 5193",
    "address": {
      "line1": "174 Duncan Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.153382,
      "lng": 28.071602
    }
  },
  {
    "id": "cust-0195",
    "email": "brett.zulu195@example.co.za",
    "firstName": "Brett",
    "lastName": "Zulu",
    "phone": "+27 76 333 2705",
    "address": {
      "line1": "149 De Korte Street, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.773707,
      "lng": 28.234253
    }
  },
  {
    "id": "cust-0196",
    "email": "tanya.gumede196@example.co.za",
    "firstName": "Tanya",
    "lastName": "Gumede",
    "phone": "+27 82 988 9985",
    "address": {
      "line1": "301 Main Road, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.139608,
      "lng": 28.025203
    }
  },
  {
    "id": "cust-0197",
    "email": "jan.maharaj197@example.co.za",
    "firstName": "Jan",
    "lastName": "Maharaj",
    "phone": "+27 83 420 3256",
    "address": {
      "line1": "208 Oxford Road, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.749332,
      "lng": 28.246409
    }
  },
  {
    "id": "cust-0198",
    "email": "jabulani.dlamini198@example.co.za",
    "firstName": "Jabulani",
    "lastName": "Dlamini",
    "phone": "+27 76 451 6407",
    "address": {
      "line1": "231 4th Avenue, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.009289,
      "lng": 28.013909
    }
  },
  {
    "id": "cust-0199",
    "email": "marike.nkosi199@example.co.za",
    "firstName": "Marike",
    "lastName": "Nkosi",
    "phone": "+27 82 471 5993",
    "address": {
      "line1": "115 4th Avenue, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.851607,
      "lng": 28.186301
    }
  },
  {
    "id": "cust-0200",
    "email": "annelize.barnardo200@example.co.za",
    "firstName": "Annelize",
    "lastName": "Barnardo",
    "phone": "+27 83 633 7237",
    "address": {
      "line1": "138 Rivonia Road, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.146556,
      "lng": 28.081452
    }
  },
  {
    "id": "cust-0201",
    "email": "anisha.mthembu201@example.co.za",
    "firstName": "Anisha",
    "lastName": "Mthembu",
    "phone": "+27 82 262 6026",
    "address": {
      "line1": "310 4th Avenue, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.198434,
      "lng": 28.025047
    }
  },
  {
    "id": "cust-0202",
    "email": "andile.daniels202@example.co.za",
    "firstName": "Andile",
    "lastName": "Daniels",
    "phone": "+27 72 445 2918",
    "address": {
      "line1": "326 Rivonia Road, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.129325,
      "lng": 28.026658
    }
  },
  {
    "id": "cust-0203",
    "email": "jan.visser203@example.co.za",
    "firstName": "Jan",
    "lastName": "Visser",
    "phone": "+27 76 938 5134",
    "address": {
      "line1": "263 Rivonia Road, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.780421,
      "lng": 28.270867
    }
  },
  {
    "id": "cust-0204",
    "email": "nandi.zulu204@example.co.za",
    "firstName": "Nandi",
    "lastName": "Zulu",
    "phone": "+27 72 364 7562",
    "address": {
      "line1": "234 Atterbury Road, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.193508,
      "lng": 28.036299
    }
  },
  {
    "id": "cust-0205",
    "email": "andile.robinson205@example.co.za",
    "firstName": "Andile",
    "lastName": "Robinson",
    "phone": "+27 72 611 6759",
    "address": {
      "line1": "331 Main Road, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.150528,
      "lng": 28.077408
    }
  },
  {
    "id": "cust-0206",
    "email": "themba.coetzee206@example.co.za",
    "firstName": "Themba",
    "lastName": "Coetzee",
    "phone": "+27 84 135 2947",
    "address": {
      "line1": "434 Lynnwood Road, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.789693,
      "lng": 28.270885
    }
  },
  {
    "id": "cust-0207",
    "email": "simba.matlala207@example.co.za",
    "firstName": "Simba",
    "lastName": "Matlala",
    "phone": "+27 79 458 8015",
    "address": {
      "line1": "304 Sandton Drive, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.152779,
      "lng": 28.0318
    }
  },
  {
    "id": "cust-0208",
    "email": "david.van wyk208@example.co.za",
    "firstName": "David",
    "lastName": "Van Wyk",
    "phone": "+27 72 669 5518",
    "address": {
      "line1": "433 William Nicol Drive, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.786183,
      "lng": 28.276884
    }
  },
  {
    "id": "cust-0209",
    "email": "nomsa.moyo209@example.co.za",
    "firstName": "Nomsa",
    "lastName": "Moyo",
    "phone": "+27 79 623 6678",
    "address": {
      "line1": "51 Church Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.141639,
      "lng": 28.01454
    }
  },
  {
    "id": "cust-0210",
    "email": "mpho.pillay210@example.co.za",
    "firstName": "Mpho",
    "lastName": "Pillay",
    "phone": "+27 72 244 4384",
    "address": {
      "line1": "369 Oxford Road, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.774113,
      "lng": 28.276382
    }
  },
  {
    "id": "cust-0211",
    "email": "boitumelo.van der merwe211@example.co.za",
    "firstName": "Boitumelo",
    "lastName": "Van Der Merwe",
    "phone": "+27 83 318 5192",
    "address": {
      "line1": "31 Stanley Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.161356,
      "lng": 28.08442
    }
  },
  {
    "id": "cust-0212",
    "email": "francois.hendricks212@example.co.za",
    "firstName": "Francois",
    "lastName": "Hendricks",
    "phone": "+27 82 303 4325",
    "address": {
      "line1": "314 Stanley Street, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.106926,
      "lng": 28.051765
    }
  },
  {
    "id": "cust-0213",
    "email": "cobus.mokoena213@example.co.za",
    "firstName": "Cobus",
    "lastName": "Mokoena",
    "phone": "+27 84 321 2670",
    "address": {
      "line1": "281 Juta Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.136677,
      "lng": 28.008679
    }
  },
  {
    "id": "cust-0214",
    "email": "nomsa.gumbo214@example.co.za",
    "firstName": "Nomsa",
    "lastName": "Gumbo",
    "phone": "+27 82 159 2784",
    "address": {
      "line1": "324 Sandton Drive, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.022115,
      "lng": 28.001248
    }
  },
  {
    "id": "cust-0215",
    "email": "tendai.hendricks215@example.co.za",
    "firstName": "Tendai",
    "lastName": "Hendricks",
    "phone": "+27 84 675 1888",
    "address": {
      "line1": "173 De Korte Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.18872,
      "lng": 28.031694
    }
  },
  {
    "id": "cust-0216",
    "email": "david.du plessis216@example.co.za",
    "firstName": "David",
    "lastName": "Du Plessis",
    "phone": "+27 82 390 8872",
    "address": {
      "line1": "338 William Nicol Drive, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.014736,
      "lng": 28.006424
    }
  },
  {
    "id": "cust-0217",
    "email": "jacques.van wyk217@example.co.za",
    "firstName": "Jacques",
    "lastName": "Van Wyk",
    "phone": "+27 82 792 4292",
    "address": {
      "line1": "264 Duncan Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.190025,
      "lng": 28.035101
    }
  },
  {
    "id": "cust-0218",
    "email": "jabulani.coetzee218@example.co.za",
    "firstName": "Jabulani",
    "lastName": "Coetzee",
    "phone": "+27 72 538 5369",
    "address": {
      "line1": "378 Grant Avenue, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.751089,
      "lng": 28.247461
    }
  },
  {
    "id": "cust-0219",
    "email": "jan.moyo219@example.co.za",
    "firstName": "Jan",
    "lastName": "Moyo",
    "phone": "+27 82 150 1992",
    "address": {
      "line1": "391 Atterbury Road, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.859059,
      "lng": 28.195351
    }
  },
  {
    "id": "cust-0220",
    "email": "michael.maharaj220@example.co.za",
    "firstName": "Michael",
    "lastName": "Maharaj",
    "phone": "+27 72 117 6717",
    "address": {
      "line1": "149 Sandton Drive, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.014054,
      "lng": 28.013814
    }
  },
  {
    "id": "cust-0221",
    "email": "andile.sibanda221@example.co.za",
    "firstName": "Andile",
    "lastName": "Sibanda",
    "phone": "+27 84 493 2766",
    "address": {
      "line1": "328 Rivonia Road, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.001098,
      "lng": 28.119197
    }
  },
  {
    "id": "cust-0222",
    "email": "esme.du randt222@example.co.za",
    "firstName": "Esme",
    "lastName": "Du Randt",
    "phone": "+27 83 202 6028",
    "address": {
      "line1": "290 William Nicol Drive, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.177111,
      "lng": 28.002992
    }
  },
  {
    "id": "cust-0223",
    "email": "marike.visser223@example.co.za",
    "firstName": "Marike",
    "lastName": "Visser",
    "phone": "+27 72 533 7058",
    "address": {
      "line1": "280 4th Avenue, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.001168,
      "lng": 28.12532
    }
  },
  {
    "id": "cust-0224",
    "email": "lerato.padayachee224@example.co.za",
    "firstName": "Lerato",
    "lastName": "Padayachee",
    "phone": "+27 84 240 9079",
    "address": {
      "line1": "324 Lynnwood Road, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.789214,
      "lng": 28.280437
    }
  },
  {
    "id": "cust-0225",
    "email": "dirk.phiri225@example.co.za",
    "firstName": "Dirk",
    "lastName": "Phiri",
    "phone": "+27 82 246 8980",
    "address": {
      "line1": "335 William Nicol Drive, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.77856,
      "lng": 28.274682
    }
  },
  {
    "id": "cust-0226",
    "email": "willem.nkosi226@example.co.za",
    "firstName": "Willem",
    "lastName": "Nkosi",
    "phone": "+27 84 841 2316",
    "address": {
      "line1": "57 Charles Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.185434,
      "lng": 28.036452
    }
  },
  {
    "id": "cust-0227",
    "email": "nomsa.grobbelaar227@example.co.za",
    "firstName": "Nomsa",
    "lastName": "Grobbelaar",
    "phone": "+27 83 378 3310",
    "address": {
      "line1": "216 Fehrsen Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.155005,
      "lng": 28.076615
    }
  },
  {
    "id": "cust-0228",
    "email": "annelize.miller228@example.co.za",
    "firstName": "Annelize",
    "lastName": "Miller",
    "phone": "+27 84 882 7849",
    "address": {
      "line1": "376 Rivonia Road, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.115472,
      "lng": 28.065853
    }
  },
  {
    "id": "cust-0229",
    "email": "anisha.phiri229@example.co.za",
    "firstName": "Anisha",
    "lastName": "Phiri",
    "phone": "+27 79 740 7491",
    "address": {
      "line1": "229 Charles Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.010018,
      "lng": 28.007943
    }
  },
  {
    "id": "cust-0230",
    "email": "reneilwe.mthembu230@example.co.za",
    "firstName": "Reneilwe",
    "lastName": "Mthembu",
    "phone": "+27 72 608 9457",
    "address": {
      "line1": "304 Charles Street, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.757436,
      "lng": 28.247162
    }
  },
  {
    "id": "cust-0231",
    "email": "kagiso.matlala231@example.co.za",
    "firstName": "Kagiso",
    "lastName": "Matlala",
    "phone": "+27 79 909 8635",
    "address": {
      "line1": "262 Charles Street, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.180113,
      "lng": 28.005639
    }
  },
  {
    "id": "cust-0232",
    "email": "francois.adams232@example.co.za",
    "firstName": "Francois",
    "lastName": "Adams",
    "phone": "+27 79 831 1582",
    "address": {
      "line1": "198 Stanley Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.997688,
      "lng": 28.132226
    }
  },
  {
    "id": "cust-0233",
    "email": "jabulani.molefe233@example.co.za",
    "firstName": "Jabulani",
    "lastName": "Molefe",
    "phone": "+27 83 630 6520",
    "address": {
      "line1": "438 Oxford Road, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.769775,
      "lng": 28.243513
    }
  },
  {
    "id": "cust-0234",
    "email": "preetha.zulu234@example.co.za",
    "firstName": "Preetha",
    "lastName": "Zulu",
    "phone": "+27 82 928 8338",
    "address": {
      "line1": "295 Sandton Drive, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.129051,
      "lng": 28.018373
    }
  },
  {
    "id": "cust-0235",
    "email": "pieter.robinson235@example.co.za",
    "firstName": "Pieter",
    "lastName": "Robinson",
    "phone": "+27 76 814 8590",
    "address": {
      "line1": "262 Charles Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.20251,
      "lng": 28.036135
    }
  },
  {
    "id": "cust-0236",
    "email": "annelize.steyn236@example.co.za",
    "firstName": "Annelize",
    "lastName": "Steyn",
    "phone": "+27 76 143 9501",
    "address": {
      "line1": "18 De Korte Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.781488,
      "lng": 28.283102
    }
  },
  {
    "id": "cust-0237",
    "email": "lebohang.daniels237@example.co.za",
    "firstName": "Lebohang",
    "lastName": "Daniels",
    "phone": "+27 76 638 3957",
    "address": {
      "line1": "323 Stanley Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.781451,
      "lng": 28.265989
    }
  },
  {
    "id": "cust-0238",
    "email": "blessing.grobbelaar238@example.co.za",
    "firstName": "Blessing",
    "lastName": "Grobbelaar",
    "phone": "+27 83 388 7515",
    "address": {
      "line1": "272 Juta Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.14925,
      "lng": 28.086804
    }
  },
  {
    "id": "cust-0239",
    "email": "nandi.moyo239@example.co.za",
    "firstName": "Nandi",
    "lastName": "Moyo",
    "phone": "+27 76 648 6398",
    "address": {
      "line1": "243 Jan Smuts Avenue, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.777242,
      "lng": 28.278861
    }
  },
  {
    "id": "cust-0240",
    "email": "sibusiso.fourie240@example.co.za",
    "firstName": "Sibusiso",
    "lastName": "Fourie",
    "phone": "+27 84 641 1493",
    "address": {
      "line1": "197 Church Street, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.155081,
      "lng": 28.041319
    }
  },
  {
    "id": "cust-0241",
    "email": "kefilwe.du plessis241@example.co.za",
    "firstName": "Kefilwe",
    "lastName": "Du Plessis",
    "phone": "+27 82 154 4357",
    "address": {
      "line1": "78 Main Road, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.011675,
      "lng": 28.001965
    }
  },
  {
    "id": "cust-0242",
    "email": "bongani.singh242@example.co.za",
    "firstName": "Bongani",
    "lastName": "Singh",
    "phone": "+27 82 945 3211",
    "address": {
      "line1": "64 7th Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.006803,
      "lng": 28.018823
    }
  },
  {
    "id": "cust-0243",
    "email": "etienne.chetty243@example.co.za",
    "firstName": "Etienne",
    "lastName": "Chetty",
    "phone": "+27 79 634 6945",
    "address": {
      "line1": "217 4th Avenue, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.147008,
      "lng": 28.079097
    }
  },
  {
    "id": "cust-0244",
    "email": "bongani.zuma244@example.co.za",
    "firstName": "Bongani",
    "lastName": "Zuma",
    "phone": "+27 79 712 5115",
    "address": {
      "line1": "430 Atterbury Road, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.758052,
      "lng": 28.241752
    }
  },
  {
    "id": "cust-0245",
    "email": "gareth.miller245@example.co.za",
    "firstName": "Gareth",
    "lastName": "Miller",
    "phone": "+27 83 733 5942",
    "address": {
      "line1": "231 Grant Avenue, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.107438,
      "lng": 28.051223
    }
  },
  {
    "id": "cust-0246",
    "email": "simba.ross246@example.co.za",
    "firstName": "Simba",
    "lastName": "Ross",
    "phone": "+27 79 320 8315",
    "address": {
      "line1": "232 Sandton Drive, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.146897,
      "lng": 28.067757
    }
  },
  {
    "id": "cust-0247",
    "email": "blessing.snyman247@example.co.za",
    "firstName": "Blessing",
    "lastName": "Snyman",
    "phone": "+27 84 861 6790",
    "address": {
      "line1": "277 Rivonia Road, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.168247,
      "lng": 28.007299
    }
  },
  {
    "id": "cust-0248",
    "email": "david.sithole248@example.co.za",
    "firstName": "David",
    "lastName": "Sithole",
    "phone": "+27 79 613 2589",
    "address": {
      "line1": "144 7th Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.195713,
      "lng": 28.026892
    }
  },
  {
    "id": "cust-0249",
    "email": "nthabiseng.robinson249@example.co.za",
    "firstName": "Nthabiseng",
    "lastName": "Robinson",
    "phone": "+27 79 297 2600",
    "address": {
      "line1": "94 Jan Smuts Avenue, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.778416,
      "lng": 28.274332
    }
  },
  {
    "id": "cust-0250",
    "email": "jabulani.sibanda250@example.co.za",
    "firstName": "Jabulani",
    "lastName": "Sibanda",
    "phone": "+27 83 303 6381",
    "address": {
      "line1": "371 Juta Street, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.172828,
      "lng": 28.001638
    }
  },
  {
    "id": "cust-0251",
    "email": "lindiwe.barnardo251@example.co.za",
    "firstName": "Lindiwe",
    "lastName": "Barnardo",
    "phone": "+27 76 285 8152",
    "address": {
      "line1": "103 Grant Avenue, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.183697,
      "lng": 28.013866
    }
  },
  {
    "id": "cust-0252",
    "email": "gareth.gxilishe252@example.co.za",
    "firstName": "Gareth",
    "lastName": "Gxilishe",
    "phone": "+27 76 266 4803",
    "address": {
      "line1": "101 Oxford Road, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.005631,
      "lng": 28.011455
    }
  },
  {
    "id": "cust-0253",
    "email": "farai.steyn253@example.co.za",
    "firstName": "Farai",
    "lastName": "Steyn",
    "phone": "+27 82 535 9889",
    "address": {
      "line1": "110 Main Road, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.869061,
      "lng": 28.189403
    }
  },
  {
    "id": "cust-0254",
    "email": "tumelo.nkosi254@example.co.za",
    "firstName": "Tumelo",
    "lastName": "Nkosi",
    "phone": "+27 72 348 1632",
    "address": {
      "line1": "408 Lynnwood Road, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.862954,
      "lng": 28.188977
    }
  },
  {
    "id": "cust-0255",
    "email": "dirk.moyo255@example.co.za",
    "firstName": "Dirk",
    "lastName": "Moyo",
    "phone": "+27 82 827 2922",
    "address": {
      "line1": "104 Charles Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.78801,
      "lng": 28.28406
    }
  },
  {
    "id": "cust-0256",
    "email": "sunil.du randt256@example.co.za",
    "firstName": "Sunil",
    "lastName": "Du Randt",
    "phone": "+27 72 360 5314",
    "address": {
      "line1": "245 William Nicol Drive, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.186612,
      "lng": 28.040027
    }
  },
  {
    "id": "cust-0257",
    "email": "michael.pretorius257@example.co.za",
    "firstName": "Michael",
    "lastName": "Pretorius",
    "phone": "+27 79 503 7029",
    "address": {
      "line1": "8 Grant Avenue, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.185752,
      "lng": 28.038058
    }
  },
  {
    "id": "cust-0258",
    "email": "anisha.chetty258@example.co.za",
    "firstName": "Anisha",
    "lastName": "Chetty",
    "phone": "+27 84 779 2958",
    "address": {
      "line1": "403 Juta Street, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.863918,
      "lng": 28.186079
    }
  },
  {
    "id": "cust-0259",
    "email": "michael.barnardo259@example.co.za",
    "firstName": "Michael",
    "lastName": "Barnardo",
    "phone": "+27 83 376 7655",
    "address": {
      "line1": "176 Main Road, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.191748,
      "lng": 28.027144
    }
  },
  {
    "id": "cust-0260",
    "email": "jan.gumede260@example.co.za",
    "firstName": "Jan",
    "lastName": "Gumede",
    "phone": "+27 84 450 3343",
    "address": {
      "line1": "104 Lynnwood Road, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.755157,
      "lng": 28.242342
    }
  },
  {
    "id": "cust-0261",
    "email": "zanele.claassen261@example.co.za",
    "firstName": "Zanele",
    "lastName": "Claassen",
    "phone": "+27 72 723 1911",
    "address": {
      "line1": "398 Duncan Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.991722,
      "lng": 28.124046
    }
  },
  {
    "id": "cust-0262",
    "email": "zanele.hendricks262@example.co.za",
    "firstName": "Zanele",
    "lastName": "Hendricks",
    "phone": "+27 82 284 4913",
    "address": {
      "line1": "203 Rivonia Road, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.098436,
      "lng": 28.051386
    }
  },
  {
    "id": "cust-0263",
    "email": "sibusiso.fourie263@example.co.za",
    "firstName": "Sibusiso",
    "lastName": "Fourie",
    "phone": "+27 76 788 5573",
    "address": {
      "line1": "96 Atterbury Road, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.789937,
      "lng": 28.278264
    }
  },
  {
    "id": "cust-0264",
    "email": "tshepo.pillay264@example.co.za",
    "firstName": "Tshepo",
    "lastName": "Pillay",
    "phone": "+27 82 358 5780",
    "address": {
      "line1": "389 Jan Smuts Avenue, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.176489,
      "lng": 28.012195
    }
  },
  {
    "id": "cust-0265",
    "email": "david.daniels265@example.co.za",
    "firstName": "David",
    "lastName": "Daniels",
    "phone": "+27 72 683 3088",
    "address": {
      "line1": "176 Lynnwood Road, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.856643,
      "lng": 28.186388
    }
  },
  {
    "id": "cust-0266",
    "email": "bongani.maharaj266@example.co.za",
    "firstName": "Bongani",
    "lastName": "Maharaj",
    "phone": "+27 76 318 1720",
    "address": {
      "line1": "284 William Nicol Drive, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.754257,
      "lng": 28.235156
    }
  },
  {
    "id": "cust-0267",
    "email": "andile.barnardo267@example.co.za",
    "firstName": "Andile",
    "lastName": "Barnardo",
    "phone": "+27 76 285 2566",
    "address": {
      "line1": "226 Jan Smuts Avenue, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.100886,
      "lng": 28.049359
    }
  },
  {
    "id": "cust-0268",
    "email": "themba.molefe268@example.co.za",
    "firstName": "Themba",
    "lastName": "Molefe",
    "phone": "+27 83 374 8180",
    "address": {
      "line1": "394 Church Street, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.862335,
      "lng": 28.186283
    }
  },
  {
    "id": "cust-0269",
    "email": "kagiso.fourie269@example.co.za",
    "firstName": "Kagiso",
    "lastName": "Fourie",
    "phone": "+27 79 540 6784",
    "address": {
      "line1": "68 Lynnwood Road, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.111985,
      "lng": 28.056552
    }
  },
  {
    "id": "cust-0270",
    "email": "riaan.du randt270@example.co.za",
    "firstName": "Riaan",
    "lastName": "Du Randt",
    "phone": "+27 82 204 7268",
    "address": {
      "line1": "208 4th Avenue, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.011079,
      "lng": 28.003971
    }
  },
  {
    "id": "cust-0271",
    "email": "neo.moodley271@example.co.za",
    "firstName": "Neo",
    "lastName": "Moodley",
    "phone": "+27 82 857 8188",
    "address": {
      "line1": "258 Jan Smuts Avenue, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.187479,
      "lng": 28.038203
    }
  },
  {
    "id": "cust-0272",
    "email": "mpho.maharaj272@example.co.za",
    "firstName": "Mpho",
    "lastName": "Maharaj",
    "phone": "+27 79 253 8764",
    "address": {
      "line1": "197 Atterbury Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.139087,
      "lng": 28.046285
    }
  },
  {
    "id": "cust-0273",
    "email": "willem.zulu273@example.co.za",
    "firstName": "Willem",
    "lastName": "Zulu",
    "phone": "+27 82 715 7888",
    "address": {
      "line1": "186 7th Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.012635,
      "lng": 28.010964
    }
  },
  {
    "id": "cust-0274",
    "email": "keabetswe.sibanda274@example.co.za",
    "firstName": "Keabetswe",
    "lastName": "Sibanda",
    "phone": "+27 84 931 9112",
    "address": {
      "line1": "69 Main Road, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.176141,
      "lng": 28.009683
    }
  },
  {
    "id": "cust-0275",
    "email": "tumelo.gumbo275@example.co.za",
    "firstName": "Tumelo",
    "lastName": "Gumbo",
    "phone": "+27 72 958 4661",
    "address": {
      "line1": "73 William Nicol Drive, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.858229,
      "lng": 28.194288
    }
  },
  {
    "id": "cust-0276",
    "email": "jacques.botha276@example.co.za",
    "firstName": "Jacques",
    "lastName": "Botha",
    "phone": "+27 79 617 1423",
    "address": {
      "line1": "10 Stanley Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.787421,
      "lng": 28.282272
    }
  },
  {
    "id": "cust-0277",
    "email": "thabo.van wyk277@example.co.za",
    "firstName": "Thabo",
    "lastName": "Van Wyk",
    "phone": "+27 83 297 7954",
    "address": {
      "line1": "125 4th Avenue, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.182388,
      "lng": 28.002355
    }
  },
  {
    "id": "cust-0278",
    "email": "brett.chetty278@example.co.za",
    "firstName": "Brett",
    "lastName": "Chetty",
    "phone": "+27 84 555 9475",
    "address": {
      "line1": "444 Main Road, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.754679,
      "lng": 28.231895
    }
  },
  {
    "id": "cust-0279",
    "email": "boitumelo.barnardo279@example.co.za",
    "firstName": "Boitumelo",
    "lastName": "Barnardo",
    "phone": "+27 76 511 2876",
    "address": {
      "line1": "430 Atterbury Road, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.157903,
      "lng": 28.084128
    }
  },
  {
    "id": "cust-0280",
    "email": "itumeleng.barnardo280@example.co.za",
    "firstName": "Itumeleng",
    "lastName": "Barnardo",
    "phone": "+27 79 455 1712",
    "address": {
      "line1": "276 Lynnwood Road, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.014188,
      "lng": 28.009854
    }
  },
  {
    "id": "cust-0281",
    "email": "sibusiso.ncube281@example.co.za",
    "firstName": "Sibusiso",
    "lastName": "Ncube",
    "phone": "+27 82 543 2205",
    "address": {
      "line1": "261 Duncan Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.137503,
      "lng": 28.021639
    }
  },
  {
    "id": "cust-0282",
    "email": "kudzai.ross282@example.co.za",
    "firstName": "Kudzai",
    "lastName": "Ross",
    "phone": "+27 79 996 9245",
    "address": {
      "line1": "396 Grant Avenue, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.857848,
      "lng": 28.182766
    }
  },
  {
    "id": "cust-0283",
    "email": "nomsa.nel283@example.co.za",
    "firstName": "Nomsa",
    "lastName": "Nel",
    "phone": "+27 84 205 5387",
    "address": {
      "line1": "374 William Nicol Drive, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.777705,
      "lng": 28.243011
    }
  },
  {
    "id": "cust-0284",
    "email": "pieter.zuma284@example.co.za",
    "firstName": "Pieter",
    "lastName": "Zuma",
    "phone": "+27 83 623 6852",
    "address": {
      "line1": "274 Sandton Drive, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.148768,
      "lng": 28.068253
    }
  },
  {
    "id": "cust-0285",
    "email": "reneilwe.reddy285@example.co.za",
    "firstName": "Reneilwe",
    "lastName": "Reddy",
    "phone": "+27 82 874 8531",
    "address": {
      "line1": "207 Duncan Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.153422,
      "lng": 28.076819
    }
  },
  {
    "id": "cust-0286",
    "email": "sunil.botha286@example.co.za",
    "firstName": "Sunil",
    "lastName": "Botha",
    "phone": "+27 82 146 6978",
    "address": {
      "line1": "267 Grant Avenue, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.853708,
      "lng": 28.181761
    }
  },
  {
    "id": "cust-0287",
    "email": "priya.moodley287@example.co.za",
    "firstName": "Priya",
    "lastName": "Moodley",
    "phone": "+27 76 494 2416",
    "address": {
      "line1": "333 Grant Avenue, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.14364,
      "lng": 28.022971
    }
  },
  {
    "id": "cust-0288",
    "email": "kefilwe.adams288@example.co.za",
    "firstName": "Kefilwe",
    "lastName": "Adams",
    "phone": "+27 83 742 6734",
    "address": {
      "line1": "164 De Korte Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.145393,
      "lng": 28.015919
    }
  },
  {
    "id": "cust-0289",
    "email": "themba.van der merwe289@example.co.za",
    "firstName": "Themba",
    "lastName": "Van Der Merwe",
    "phone": "+27 76 878 3486",
    "address": {
      "line1": "257 De Korte Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.789863,
      "lng": 28.284037
    }
  },
  {
    "id": "cust-0290",
    "email": "lebohang.padayachee290@example.co.za",
    "firstName": "Lebohang",
    "lastName": "Padayachee",
    "phone": "+27 82 758 3896",
    "address": {
      "line1": "287 William Nicol Drive, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.126986,
      "lng": 28.020026
    }
  },
  {
    "id": "cust-0291",
    "email": "annelize.coetzee291@example.co.za",
    "firstName": "Annelize",
    "lastName": "Coetzee",
    "phone": "+27 72 303 9853",
    "address": {
      "line1": "118 William Nicol Drive, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.769427,
      "lng": 28.241001
    }
  },
  {
    "id": "cust-0292",
    "email": "david.hendricks292@example.co.za",
    "firstName": "David",
    "lastName": "Hendricks",
    "phone": "+27 82 303 9911",
    "address": {
      "line1": "192 7th Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.130637,
      "lng": 28.026273
    }
  },
  {
    "id": "cust-0293",
    "email": "kudzai.matlala293@example.co.za",
    "firstName": "Kudzai",
    "lastName": "Matlala",
    "phone": "+27 79 213 8293",
    "address": {
      "line1": "438 De Korte Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.202573,
      "lng": 28.026051
    }
  },
  {
    "id": "cust-0294",
    "email": "reneilwe.matlala294@example.co.za",
    "firstName": "Reneilwe",
    "lastName": "Matlala",
    "phone": "+27 83 155 5889",
    "address": {
      "line1": "367 Sandton Drive, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.74199,
      "lng": 28.228699
    }
  },
  {
    "id": "cust-0295",
    "email": "zanele.gumede295@example.co.za",
    "firstName": "Zanele",
    "lastName": "Gumede",
    "phone": "+27 76 819 5252",
    "address": {
      "line1": "373 Main Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.147395,
      "lng": 28.0492
    }
  },
  {
    "id": "cust-0296",
    "email": "willem.govender296@example.co.za",
    "firstName": "Willem",
    "lastName": "Govender",
    "phone": "+27 82 359 3607",
    "address": {
      "line1": "184 4th Avenue, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.146967,
      "lng": 28.07388
    }
  },
  {
    "id": "cust-0297",
    "email": "lebohang.sibanda297@example.co.za",
    "firstName": "Lebohang",
    "lastName": "Sibanda",
    "phone": "+27 72 899 9841",
    "address": {
      "line1": "312 Grant Avenue, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.78035,
      "lng": 28.284744
    }
  },
  {
    "id": "cust-0298",
    "email": "lindiwe.moodley298@example.co.za",
    "firstName": "Lindiwe",
    "lastName": "Moodley",
    "phone": "+27 84 327 4511",
    "address": {
      "line1": "200 Main Road, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.103406,
      "lng": 28.053454
    }
  },
  {
    "id": "cust-0299",
    "email": "francois.reddy299@example.co.za",
    "firstName": "Francois",
    "lastName": "Reddy",
    "phone": "+27 82 898 4837",
    "address": {
      "line1": "276 4th Avenue, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.147536,
      "lng": 28.041447
    }
  },
  {
    "id": "cust-0300",
    "email": "tendai.ross300@example.co.za",
    "firstName": "Tendai",
    "lastName": "Ross",
    "phone": "+27 84 435 9710",
    "address": {
      "line1": "252 Grant Avenue, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.750473,
      "lng": 28.23287
    }
  },
  {
    "id": "cust-0301",
    "email": "katlego.singh301@example.co.za",
    "firstName": "Katlego",
    "lastName": "Singh",
    "phone": "+27 76 326 4685",
    "address": {
      "line1": "422 Jan Smuts Avenue, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.017734,
      "lng": 28.000967
    }
  },
  {
    "id": "cust-0302",
    "email": "nthabiseng.patel302@example.co.za",
    "firstName": "Nthabiseng",
    "lastName": "Patel",
    "phone": "+27 72 628 8984",
    "address": {
      "line1": "114 Church Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.006445,
      "lng": 28.124683
    }
  },
  {
    "id": "cust-0303",
    "email": "dirk.miller303@example.co.za",
    "firstName": "Dirk",
    "lastName": "Miller",
    "phone": "+27 83 262 2496",
    "address": {
      "line1": "39 Oxford Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.154425,
      "lng": 28.041512
    }
  },
  {
    "id": "cust-0304",
    "email": "kabelo.dlamini304@example.co.za",
    "firstName": "Kabelo",
    "lastName": "Dlamini",
    "phone": "+27 84 517 2777",
    "address": {
      "line1": "441 Lynnwood Road, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.147249,
      "lng": 28.078373
    }
  },
  {
    "id": "cust-0305",
    "email": "claire.visser305@example.co.za",
    "firstName": "Claire",
    "lastName": "Visser",
    "phone": "+27 83 149 4048",
    "address": {
      "line1": "448 Church Street, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.857061,
      "lng": 28.195023
    }
  },
  {
    "id": "cust-0306",
    "email": "reneilwe.nel306@example.co.za",
    "firstName": "Reneilwe",
    "lastName": "Nel",
    "phone": "+27 79 981 3199",
    "address": {
      "line1": "421 Atterbury Road, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.006174,
      "lng": 28.124501
    }
  },
  {
    "id": "cust-0307",
    "email": "johan.gumbo307@example.co.za",
    "firstName": "Johan",
    "lastName": "Gumbo",
    "phone": "+27 82 600 4785",
    "address": {
      "line1": "105 Church Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.004615,
      "lng": 28.129405
    }
  },
  {
    "id": "cust-0308",
    "email": "helena.pretorius308@example.co.za",
    "firstName": "Helena",
    "lastName": "Pretorius",
    "phone": "+27 79 963 5028",
    "address": {
      "line1": "227 Church Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.777352,
      "lng": 28.270201
    }
  },
  {
    "id": "cust-0309",
    "email": "francois.zulu309@example.co.za",
    "firstName": "Francois",
    "lastName": "Zulu",
    "phone": "+27 79 491 8818",
    "address": {
      "line1": "349 Rivonia Road, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.775986,
      "lng": 28.239072
    }
  },
  {
    "id": "cust-0310",
    "email": "kagiso.sithole310@example.co.za",
    "firstName": "Kagiso",
    "lastName": "Sithole",
    "phone": "+27 84 274 7710",
    "address": {
      "line1": "165 Atterbury Road, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.765599,
      "lng": 28.245395
    }
  },
  {
    "id": "cust-0311",
    "email": "ayanda.fourie311@example.co.za",
    "firstName": "Ayanda",
    "lastName": "Fourie",
    "phone": "+27 79 968 8925",
    "address": {
      "line1": "203 Main Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.153884,
      "lng": 28.041148
    }
  },
  {
    "id": "cust-0312",
    "email": "themba.adams312@example.co.za",
    "firstName": "Themba",
    "lastName": "Adams",
    "phone": "+27 82 293 7354",
    "address": {
      "line1": "123 William Nicol Drive, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.114227,
      "lng": 28.064258
    }
  },
  {
    "id": "cust-0313",
    "email": "hendrik.daniels313@example.co.za",
    "firstName": "Hendrik",
    "lastName": "Daniels",
    "phone": "+27 82 140 8551",
    "address": {
      "line1": "21 Main Road, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.863269,
      "lng": 28.182479
    }
  },
  {
    "id": "cust-0314",
    "email": "sipho.ndlovu314@example.co.za",
    "firstName": "Sipho",
    "lastName": "Ndlovu",
    "phone": "+27 84 764 3739",
    "address": {
      "line1": "224 Main Road, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.775122,
      "lng": 28.229
    }
  },
  {
    "id": "cust-0315",
    "email": "kabelo.khumalo315@example.co.za",
    "firstName": "Kabelo",
    "lastName": "Khumalo",
    "phone": "+27 82 987 4806",
    "address": {
      "line1": "43 Stanley Street, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.145464,
      "lng": 28.046892
    }
  },
  {
    "id": "cust-0316",
    "email": "lebohang.phiri316@example.co.za",
    "firstName": "Lebohang",
    "lastName": "Phiri",
    "phone": "+27 72 798 4309",
    "address": {
      "line1": "423 4th Avenue, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.74799,
      "lng": 28.245888
    }
  },
  {
    "id": "cust-0317",
    "email": "andile.ndlovu317@example.co.za",
    "firstName": "Andile",
    "lastName": "Ndlovu",
    "phone": "+27 72 953 4469",
    "address": {
      "line1": "141 William Nicol Drive, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.869335,
      "lng": 28.197688
    }
  },
  {
    "id": "cust-0318",
    "email": "lerato.govender318@example.co.za",
    "firstName": "Lerato",
    "lastName": "Govender",
    "phone": "+27 72 473 7176",
    "address": {
      "line1": "409 De Korte Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.989065,
      "lng": 28.135808
    }
  },
  {
    "id": "cust-0319",
    "email": "kudzai.govender319@example.co.za",
    "firstName": "Kudzai",
    "lastName": "Govender",
    "phone": "+27 79 148 9984",
    "address": {
      "line1": "321 7th Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.20003,
      "lng": 28.037257
    }
  },
  {
    "id": "cust-0320",
    "email": "tumelo.mokoena320@example.co.za",
    "firstName": "Tumelo",
    "lastName": "Mokoena",
    "phone": "+27 84 333 8116",
    "address": {
      "line1": "254 Juta Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.165589,
      "lng": 28.076247
    }
  },
  {
    "id": "cust-0321",
    "email": "kudzai.zuma321@example.co.za",
    "firstName": "Kudzai",
    "lastName": "Zuma",
    "phone": "+27 79 250 2462",
    "address": {
      "line1": "170 Church Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.020495,
      "lng": 28.004338
    }
  },
  {
    "id": "cust-0322",
    "email": "refilwe.maharaj322@example.co.za",
    "firstName": "Refilwe",
    "lastName": "Maharaj",
    "phone": "+27 72 589 4575",
    "address": {
      "line1": "14 Grant Avenue, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.767255,
      "lng": 28.239418
    }
  },
  {
    "id": "cust-0323",
    "email": "hendrik.phiri323@example.co.za",
    "firstName": "Hendrik",
    "lastName": "Phiri",
    "phone": "+27 84 404 2680",
    "address": {
      "line1": "413 Jan Smuts Avenue, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.76405,
      "lng": 28.234609
    }
  },
  {
    "id": "cust-0324",
    "email": "blessing.patel324@example.co.za",
    "firstName": "Blessing",
    "lastName": "Patel",
    "phone": "+27 83 919 5664",
    "address": {
      "line1": "78 Church Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.991622,
      "lng": 28.117017
    }
  },
  {
    "id": "cust-0325",
    "email": "nomsa.phiri325@example.co.za",
    "firstName": "Nomsa",
    "lastName": "Phiri",
    "phone": "+27 82 921 3083",
    "address": {
      "line1": "253 Sandton Drive, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.774832,
      "lng": 28.266105
    }
  },
  {
    "id": "cust-0326",
    "email": "themba.zuma326@example.co.za",
    "firstName": "Themba",
    "lastName": "Zuma",
    "phone": "+27 83 868 3160",
    "address": {
      "line1": "17 Oxford Road, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.112785,
      "lng": 28.056709
    }
  },
  {
    "id": "cust-0327",
    "email": "hendrik.sibanda327@example.co.za",
    "firstName": "Hendrik",
    "lastName": "Sibanda",
    "phone": "+27 79 379 4783",
    "address": {
      "line1": "431 Stanley Street, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.105711,
      "lng": 28.051077
    }
  },
  {
    "id": "cust-0328",
    "email": "themba.zuma328@example.co.za",
    "firstName": "Themba",
    "lastName": "Zuma",
    "phone": "+27 84 846 2508",
    "address": {
      "line1": "438 Charles Street, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.147228,
      "lng": 28.044152
    }
  },
  {
    "id": "cust-0329",
    "email": "priya.gxilishe329@example.co.za",
    "firstName": "Priya",
    "lastName": "Gxilishe",
    "phone": "+27 76 522 6557",
    "address": {
      "line1": "268 Lynnwood Road, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.764261,
      "lng": 28.232979
    }
  },
  {
    "id": "cust-0330",
    "email": "kagiso.patel330@example.co.za",
    "firstName": "Kagiso",
    "lastName": "Patel",
    "phone": "+27 76 132 5819",
    "address": {
      "line1": "180 Rivonia Road, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.00603,
      "lng": 28.124152
    }
  },
  {
    "id": "cust-0331",
    "email": "andile.zulu331@example.co.za",
    "firstName": "Andile",
    "lastName": "Zulu",
    "phone": "+27 79 962 8850",
    "address": {
      "line1": "419 4th Avenue, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.740709,
      "lng": 28.229991
    }
  },
  {
    "id": "cust-0332",
    "email": "kudzai.nel332@example.co.za",
    "firstName": "Kudzai",
    "lastName": "Nel",
    "phone": "+27 84 869 9871",
    "address": {
      "line1": "114 Main Road, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.774644,
      "lng": 28.238552
    }
  },
  {
    "id": "cust-0333",
    "email": "nandi.ndlovu333@example.co.za",
    "firstName": "Nandi",
    "lastName": "Ndlovu",
    "phone": "+27 83 775 5772",
    "address": {
      "line1": "75 Church Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.791245,
      "lng": 28.269775
    }
  },
  {
    "id": "cust-0334",
    "email": "bongani.gumbo334@example.co.za",
    "firstName": "Bongani",
    "lastName": "Gumbo",
    "phone": "+27 84 970 1108",
    "address": {
      "line1": "46 William Nicol Drive, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.790241,
      "lng": 28.267455
    }
  },
  {
    "id": "cust-0335",
    "email": "andile.coetzee335@example.co.za",
    "firstName": "Andile",
    "lastName": "Coetzee",
    "phone": "+27 79 707 1101",
    "address": {
      "line1": "306 Grant Avenue, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.785801,
      "lng": 28.265363
    }
  },
  {
    "id": "cust-0336",
    "email": "preetha.phiri336@example.co.za",
    "firstName": "Preetha",
    "lastName": "Phiri",
    "phone": "+27 83 211 1641",
    "address": {
      "line1": "415 William Nicol Drive, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.200124,
      "lng": 28.028079
    }
  },
  {
    "id": "cust-0337",
    "email": "cobus.snyman337@example.co.za",
    "firstName": "Cobus",
    "lastName": "Snyman",
    "phone": "+27 76 569 3283",
    "address": {
      "line1": "69 De Korte Street, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.143192,
      "lng": 28.03828
    }
  },
  {
    "id": "cust-0338",
    "email": "nomsa.du plessis338@example.co.za",
    "firstName": "Nomsa",
    "lastName": "Du Plessis",
    "phone": "+27 79 637 4248",
    "address": {
      "line1": "244 Oxford Road, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.191099,
      "lng": 28.023544
    }
  },
  {
    "id": "cust-0339",
    "email": "katlego.pretorius339@example.co.za",
    "firstName": "Katlego",
    "lastName": "Pretorius",
    "phone": "+27 84 838 8427",
    "address": {
      "line1": "152 Main Road, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.989032,
      "lng": 28.126798
    }
  },
  {
    "id": "cust-0340",
    "email": "kudzai.matlala340@example.co.za",
    "firstName": "Kudzai",
    "lastName": "Matlala",
    "phone": "+27 83 360 3374",
    "address": {
      "line1": "337 Church Street, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.757229,
      "lng": 28.236896
    }
  },
  {
    "id": "cust-0341",
    "email": "lebohang.meyer341@example.co.za",
    "firstName": "Lebohang",
    "lastName": "Meyer",
    "phone": "+27 83 359 7312",
    "address": {
      "line1": "228 Stanley Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.994205,
      "lng": 28.131028
    }
  },
  {
    "id": "cust-0342",
    "email": "jabulani.chetty342@example.co.za",
    "firstName": "Jabulani",
    "lastName": "Chetty",
    "phone": "+27 83 557 5129",
    "address": {
      "line1": "34 Stanley Street, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.180836,
      "lng": 28.003466
    }
  },
  {
    "id": "cust-0343",
    "email": "tanya.reddy343@example.co.za",
    "firstName": "Tanya",
    "lastName": "Reddy",
    "phone": "+27 76 943 7382",
    "address": {
      "line1": "252 William Nicol Drive, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.787317,
      "lng": 28.267139
    }
  },
  {
    "id": "cust-0344",
    "email": "esme.adams344@example.co.za",
    "firstName": "Esme",
    "lastName": "Adams",
    "phone": "+27 84 472 7292",
    "address": {
      "line1": "107 Charles Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.158284,
      "lng": 28.07565
    }
  },
  {
    "id": "cust-0345",
    "email": "puleng.miller345@example.co.za",
    "firstName": "Puleng",
    "lastName": "Miller",
    "phone": "+27 72 868 6749",
    "address": {
      "line1": "362 Jan Smuts Avenue, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.858303,
      "lng": 28.188514
    }
  },
  {
    "id": "cust-0346",
    "email": "puleng.mokoena346@example.co.za",
    "firstName": "Puleng",
    "lastName": "Mokoena",
    "phone": "+27 79 217 3307",
    "address": {
      "line1": "112 William Nicol Drive, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.187924,
      "lng": 28.039641
    }
  },
  {
    "id": "cust-0347",
    "email": "stephan.zuma347@example.co.za",
    "firstName": "Stephan",
    "lastName": "Zuma",
    "phone": "+27 82 677 1189",
    "address": {
      "line1": "183 Rivonia Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.150704,
      "lng": 28.049142
    }
  },
  {
    "id": "cust-0348",
    "email": "michael.khumalo348@example.co.za",
    "firstName": "Michael",
    "lastName": "Khumalo",
    "phone": "+27 82 570 1284",
    "address": {
      "line1": "86 Charles Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.0095,
      "lng": 28.012278
    }
  },
  {
    "id": "cust-0349",
    "email": "mpho.nkosi349@example.co.za",
    "firstName": "Mpho",
    "lastName": "Nkosi",
    "phone": "+27 72 583 6148",
    "address": {
      "line1": "218 Main Road, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.776816,
      "lng": 28.240136
    }
  },
  {
    "id": "cust-0350",
    "email": "helena.coetzee350@example.co.za",
    "firstName": "Helena",
    "lastName": "Coetzee",
    "phone": "+27 82 674 4003",
    "address": {
      "line1": "304 De Korte Street, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.117332,
      "lng": 28.062038
    }
  },
  {
    "id": "cust-0351",
    "email": "bongani.ross351@example.co.za",
    "firstName": "Bongani",
    "lastName": "Ross",
    "phone": "+27 83 264 3737",
    "address": {
      "line1": "406 Atterbury Road, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.159693,
      "lng": 28.07419
    }
  },
  {
    "id": "cust-0352",
    "email": "puleng.botha352@example.co.za",
    "firstName": "Puleng",
    "lastName": "Botha",
    "phone": "+27 82 841 3906",
    "address": {
      "line1": "419 Grant Avenue, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.774359,
      "lng": 28.245956
    }
  },
  {
    "id": "cust-0353",
    "email": "johan.van wyk353@example.co.za",
    "firstName": "Johan",
    "lastName": "Van Wyk",
    "phone": "+27 76 162 3733",
    "address": {
      "line1": "321 Jan Smuts Avenue, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.753334,
      "lng": 28.243271
    }
  },
  {
    "id": "cust-0354",
    "email": "preetha.phiri354@example.co.za",
    "firstName": "Preetha",
    "lastName": "Phiri",
    "phone": "+27 76 549 2106",
    "address": {
      "line1": "272 William Nicol Drive, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.126849,
      "lng": 28.015883
    }
  },
  {
    "id": "cust-0355",
    "email": "puleng.zulu355@example.co.za",
    "firstName": "Puleng",
    "lastName": "Zulu",
    "phone": "+27 83 691 2581",
    "address": {
      "line1": "117 Atterbury Road, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.744022,
      "lng": 28.238036
    }
  },
  {
    "id": "cust-0356",
    "email": "christo.molefe356@example.co.za",
    "firstName": "Christo",
    "lastName": "Molefe",
    "phone": "+27 83 642 6380",
    "address": {
      "line1": "84 Main Road, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.129676,
      "lng": 28.017274
    }
  },
  {
    "id": "cust-0357",
    "email": "andile.ncube357@example.co.za",
    "firstName": "Andile",
    "lastName": "Ncube",
    "phone": "+27 72 226 2392",
    "address": {
      "line1": "434 Stanley Street, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.109235,
      "lng": 28.057491
    }
  },
  {
    "id": "cust-0358",
    "email": "stephan.moodley358@example.co.za",
    "firstName": "Stephan",
    "lastName": "Moodley",
    "phone": "+27 72 732 8173",
    "address": {
      "line1": "60 Juta Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.019769,
      "lng": 28.018408
    }
  },
  {
    "id": "cust-0359",
    "email": "reneilwe.gumbo359@example.co.za",
    "firstName": "Reneilwe",
    "lastName": "Gumbo",
    "phone": "+27 76 914 8944",
    "address": {
      "line1": "343 Sandton Drive, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.151126,
      "lng": 28.045881
    }
  },
  {
    "id": "cust-0360",
    "email": "lindiwe.khumalo360@example.co.za",
    "firstName": "Lindiwe",
    "lastName": "Khumalo",
    "phone": "+27 79 795 1595",
    "address": {
      "line1": "291 Grant Avenue, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.002517,
      "lng": 28.122048
    }
  },
  {
    "id": "cust-0361",
    "email": "claire.du randt361@example.co.za",
    "firstName": "Claire",
    "lastName": "Du Randt",
    "phone": "+27 82 664 8681",
    "address": {
      "line1": "100 7th Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.002068,
      "lng": 28.132506
    }
  },
  {
    "id": "cust-0362",
    "email": "kefilwe.singh362@example.co.za",
    "firstName": "Kefilwe",
    "lastName": "Singh",
    "phone": "+27 83 677 8424",
    "address": {
      "line1": "47 4th Avenue, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.14285,
      "lng": 28.007125
    }
  },
  {
    "id": "cust-0363",
    "email": "refilwe.sibanda363@example.co.za",
    "firstName": "Refilwe",
    "lastName": "Sibanda",
    "phone": "+27 79 156 5714",
    "address": {
      "line1": "144 Stanley Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.002962,
      "lng": 28.123485
    }
  },
  {
    "id": "cust-0364",
    "email": "cobus.nkosi364@example.co.za",
    "firstName": "Cobus",
    "lastName": "Nkosi",
    "phone": "+27 83 189 1105",
    "address": {
      "line1": "85 Stanley Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.993686,
      "lng": 28.135364
    }
  },
  {
    "id": "cust-0365",
    "email": "reneilwe.naidoo365@example.co.za",
    "firstName": "Reneilwe",
    "lastName": "Naidoo",
    "phone": "+27 82 532 1821",
    "address": {
      "line1": "398 Atterbury Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.149115,
      "lng": 28.033139
    }
  },
  {
    "id": "cust-0366",
    "email": "boitumelo.nkosi366@example.co.za",
    "firstName": "Boitumelo",
    "lastName": "Nkosi",
    "phone": "+27 79 708 2750",
    "address": {
      "line1": "293 Stanley Street, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.155436,
      "lng": 28.040038
    }
  },
  {
    "id": "cust-0367",
    "email": "rajesh.ross367@example.co.za",
    "firstName": "Rajesh",
    "lastName": "Ross",
    "phone": "+27 76 805 9447",
    "address": {
      "line1": "316 Main Road, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.182589,
      "lng": 28.016414
    }
  },
  {
    "id": "cust-0368",
    "email": "claire.du randt368@example.co.za",
    "firstName": "Claire",
    "lastName": "Du Randt",
    "phone": "+27 84 179 4135",
    "address": {
      "line1": "344 William Nicol Drive, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.862887,
      "lng": 28.190957
    }
  },
  {
    "id": "cust-0369",
    "email": "cobus.mthembu369@example.co.za",
    "firstName": "Cobus",
    "lastName": "Mthembu",
    "phone": "+27 76 352 7702",
    "address": {
      "line1": "138 Juta Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.004407,
      "lng": 28.119139
    }
  },
  {
    "id": "cust-0370",
    "email": "farai.reddy370@example.co.za",
    "firstName": "Farai",
    "lastName": "Reddy",
    "phone": "+27 83 413 3705",
    "address": {
      "line1": "193 Jan Smuts Avenue, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.181244,
      "lng": 28.00779
    }
  },
  {
    "id": "cust-0371",
    "email": "jabulani.miller371@example.co.za",
    "firstName": "Jabulani",
    "lastName": "Miller",
    "phone": "+27 84 217 3365",
    "address": {
      "line1": "186 7th Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.146733,
      "lng": 28.070812
    }
  },
  {
    "id": "cust-0372",
    "email": "nthabiseng.naidoo372@example.co.za",
    "firstName": "Nthabiseng",
    "lastName": "Naidoo",
    "phone": "+27 79 587 8572",
    "address": {
      "line1": "429 4th Avenue, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.783141,
      "lng": 28.269021
    }
  },
  {
    "id": "cust-0373",
    "email": "themba.sithole373@example.co.za",
    "firstName": "Themba",
    "lastName": "Sithole",
    "phone": "+27 83 512 7880",
    "address": {
      "line1": "15 Church Street, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.173417,
      "lng": 28.003425
    }
  },
  {
    "id": "cust-0374",
    "email": "dirk.sibanda374@example.co.za",
    "firstName": "Dirk",
    "lastName": "Sibanda",
    "phone": "+27 82 347 5512",
    "address": {
      "line1": "224 Charles Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.18792,
      "lng": 28.031537
    }
  },
  {
    "id": "cust-0375",
    "email": "claire.singh375@example.co.za",
    "firstName": "Claire",
    "lastName": "Singh",
    "phone": "+27 83 215 2357",
    "address": {
      "line1": "115 Fehrsen Street, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.859604,
      "lng": 28.183818
    }
  },
  {
    "id": "cust-0376",
    "email": "riaan.robinson376@example.co.za",
    "firstName": "Riaan",
    "lastName": "Robinson",
    "phone": "+27 76 803 9971",
    "address": {
      "line1": "84 Church Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.773076,
      "lng": 28.285053
    }
  },
  {
    "id": "cust-0377",
    "email": "simba.nkosi377@example.co.za",
    "firstName": "Simba",
    "lastName": "Nkosi",
    "phone": "+27 79 269 7576",
    "address": {
      "line1": "308 Main Road, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.137915,
      "lng": 28.014067
    }
  },
  {
    "id": "cust-0378",
    "email": "lerato.van der merwe378@example.co.za",
    "firstName": "Lerato",
    "lastName": "Van Der Merwe",
    "phone": "+27 84 733 4060",
    "address": {
      "line1": "397 Atterbury Road, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.007964,
      "lng": 28.134563
    }
  },
  {
    "id": "cust-0379",
    "email": "esme.khumalo379@example.co.za",
    "firstName": "Esme",
    "lastName": "Khumalo",
    "phone": "+27 82 986 6979",
    "address": {
      "line1": "248 Atterbury Road, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.792286,
      "lng": 28.269207
    }
  },
  {
    "id": "cust-0380",
    "email": "david.snyman380@example.co.za",
    "firstName": "David",
    "lastName": "Snyman",
    "phone": "+27 72 582 6556",
    "address": {
      "line1": "287 Rivonia Road, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.995483,
      "lng": 28.121633
    }
  },
  {
    "id": "cust-0381",
    "email": "sophie.nkosi381@example.co.za",
    "firstName": "Sophie",
    "lastName": "Nkosi",
    "phone": "+27 79 944 1679",
    "address": {
      "line1": "226 Grant Avenue, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.134187,
      "lng": 28.02549
    }
  },
  {
    "id": "cust-0382",
    "email": "tendai.daniels382@example.co.za",
    "firstName": "Tendai",
    "lastName": "Daniels",
    "phone": "+27 83 760 4904",
    "address": {
      "line1": "358 Church Street, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.751915,
      "lng": 28.24042
    }
  },
  {
    "id": "cust-0383",
    "email": "katlego.ross383@example.co.za",
    "firstName": "Katlego",
    "lastName": "Ross",
    "phone": "+27 79 987 8453",
    "address": {
      "line1": "12 Atterbury Road, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.758092,
      "lng": 28.246969
    }
  },
  {
    "id": "cust-0384",
    "email": "farai.grobbelaar384@example.co.za",
    "firstName": "Farai",
    "lastName": "Grobbelaar",
    "phone": "+27 72 546 1215",
    "address": {
      "line1": "350 Atterbury Road, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.166139,
      "lng": 28.015631
    }
  },
  {
    "id": "cust-0385",
    "email": "michael.mokoena385@example.co.za",
    "firstName": "Michael",
    "lastName": "Mokoena",
    "phone": "+27 72 727 9746",
    "address": {
      "line1": "264 7th Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.009329,
      "lng": 28.019126
    }
  },
  {
    "id": "cust-0386",
    "email": "sibusiso.van der merwe386@example.co.za",
    "firstName": "Sibusiso",
    "lastName": "Van Der Merwe",
    "phone": "+27 84 284 1267",
    "address": {
      "line1": "234 William Nicol Drive, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.000509,
      "lng": 28.117409
    }
  },
  {
    "id": "cust-0387",
    "email": "claire.van wyk387@example.co.za",
    "firstName": "Claire",
    "lastName": "Van Wyk",
    "phone": "+27 79 140 8668",
    "address": {
      "line1": "169 4th Avenue, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.150588,
      "lng": 28.079221
    }
  },
  {
    "id": "cust-0388",
    "email": "lindiwe.govender388@example.co.za",
    "firstName": "Lindiwe",
    "lastName": "Govender",
    "phone": "+27 82 584 9504",
    "address": {
      "line1": "266 Rivonia Road, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.150695,
      "lng": 28.082457
    }
  },
  {
    "id": "cust-0389",
    "email": "jabulani.sithole389@example.co.za",
    "firstName": "Jabulani",
    "lastName": "Sithole",
    "phone": "+27 76 872 8997",
    "address": {
      "line1": "351 4th Avenue, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.865199,
      "lng": 28.184787
    }
  },
  {
    "id": "cust-0390",
    "email": "sunil.phiri390@example.co.za",
    "firstName": "Sunil",
    "lastName": "Phiri",
    "phone": "+27 76 326 3037",
    "address": {
      "line1": "435 Main Road, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.1527,
      "lng": 28.078992
    }
  },
  {
    "id": "cust-0391",
    "email": "nandi.singh391@example.co.za",
    "firstName": "Nandi",
    "lastName": "Singh",
    "phone": "+27 82 934 1178",
    "address": {
      "line1": "214 Fehrsen Street, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.11578,
      "lng": 28.063148
    }
  },
  {
    "id": "cust-0392",
    "email": "simba.adams392@example.co.za",
    "firstName": "Simba",
    "lastName": "Adams",
    "phone": "+27 72 652 1644",
    "address": {
      "line1": "214 Lynnwood Road, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.017631,
      "lng": 28.005834
    }
  },
  {
    "id": "cust-0393",
    "email": "marike.zulu393@example.co.za",
    "firstName": "Marike",
    "lastName": "Zulu",
    "phone": "+27 76 803 8323",
    "address": {
      "line1": "97 William Nicol Drive, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.774741,
      "lng": 28.237478
    }
  },
  {
    "id": "cust-0394",
    "email": "helena.molefe394@example.co.za",
    "firstName": "Helena",
    "lastName": "Molefe",
    "phone": "+27 84 575 8770",
    "address": {
      "line1": "407 Grant Avenue, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.784449,
      "lng": 28.280532
    }
  },
  {
    "id": "cust-0395",
    "email": "katlego.botha395@example.co.za",
    "firstName": "Katlego",
    "lastName": "Botha",
    "phone": "+27 76 224 3208",
    "address": {
      "line1": "122 Rivonia Road, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.19727,
      "lng": 28.033886
    }
  },
  {
    "id": "cust-0396",
    "email": "gareth.molefe396@example.co.za",
    "firstName": "Gareth",
    "lastName": "Molefe",
    "phone": "+27 84 372 3525",
    "address": {
      "line1": "354 Lynnwood Road, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.177178,
      "lng": 28.001012
    }
  },
  {
    "id": "cust-0397",
    "email": "annelize.ross397@example.co.za",
    "firstName": "Annelize",
    "lastName": "Ross",
    "phone": "+27 79 108 2278",
    "address": {
      "line1": "246 Fehrsen Street, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.751671,
      "lng": 28.233041
    }
  },
  {
    "id": "cust-0398",
    "email": "nthabiseng.khumalo398@example.co.za",
    "firstName": "Nthabiseng",
    "lastName": "Khumalo",
    "phone": "+27 76 187 1688",
    "address": {
      "line1": "377 Jan Smuts Avenue, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.854682,
      "lng": 28.183174
    }
  },
  {
    "id": "cust-0399",
    "email": "preetha.visser399@example.co.za",
    "firstName": "Preetha",
    "lastName": "Visser",
    "phone": "+27 72 532 3644",
    "address": {
      "line1": "157 Lynnwood Road, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.011879,
      "lng": 28.004127
    }
  },
  {
    "id": "cust-0400",
    "email": "mandla.gumede400@example.co.za",
    "firstName": "Mandla",
    "lastName": "Gumede",
    "phone": "+27 79 132 5703",
    "address": {
      "line1": "31 Duncan Street, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.766911,
      "lng": 28.24501
    }
  },
  {
    "id": "cust-0401",
    "email": "bongani.ross401@example.co.za",
    "firstName": "Bongani",
    "lastName": "Ross",
    "phone": "+27 83 242 3085",
    "address": {
      "line1": "377 Grant Avenue, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.136536,
      "lng": 28.016433
    }
  },
  {
    "id": "cust-0402",
    "email": "marike.pretorius402@example.co.za",
    "firstName": "Marike",
    "lastName": "Pretorius",
    "phone": "+27 76 984 5680",
    "address": {
      "line1": "256 De Korte Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.134709,
      "lng": 28.009258
    }
  },
  {
    "id": "cust-0403",
    "email": "itumeleng.ndlovu403@example.co.za",
    "firstName": "Itumeleng",
    "lastName": "Ndlovu",
    "phone": "+27 83 348 7044",
    "address": {
      "line1": "62 Lynnwood Road, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.117436,
      "lng": 28.057171
    }
  },
  {
    "id": "cust-0404",
    "email": "themba.gumede404@example.co.za",
    "firstName": "Themba",
    "lastName": "Gumede",
    "phone": "+27 82 989 4399",
    "address": {
      "line1": "424 De Korte Street, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.183797,
      "lng": 28.000895
    }
  },
  {
    "id": "cust-0405",
    "email": "craig.du randt405@example.co.za",
    "firstName": "Craig",
    "lastName": "Du Randt",
    "phone": "+27 76 528 6633",
    "address": {
      "line1": "51 Church Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.773035,
      "lng": 28.279836
    }
  },
  {
    "id": "cust-0406",
    "email": "rajesh.sithole406@example.co.za",
    "firstName": "Rajesh",
    "lastName": "Sithole",
    "phone": "+27 72 456 3302",
    "address": {
      "line1": "189 7th Street, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.166213,
      "lng": 28.009858
    }
  },
  {
    "id": "cust-0407",
    "email": "willem.du randt407@example.co.za",
    "firstName": "Willem",
    "lastName": "Du Randt",
    "phone": "+27 72 327 2629",
    "address": {
      "line1": "366 Fehrsen Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.003932,
      "lng": 28.116795
    }
  },
  {
    "id": "cust-0408",
    "email": "rajesh.phiri408@example.co.za",
    "firstName": "Rajesh",
    "lastName": "Phiri",
    "phone": "+27 83 664 3502",
    "address": {
      "line1": "292 Lynnwood Road, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.014325,
      "lng": 28.013996
    }
  },
  {
    "id": "cust-0409",
    "email": "mpho.phiri409@example.co.za",
    "firstName": "Mpho",
    "lastName": "Phiri",
    "phone": "+27 72 155 9477",
    "address": {
      "line1": "262 Sandton Drive, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.150909,
      "lng": 28.051304
    }
  },
  {
    "id": "cust-0410",
    "email": "itumeleng.moyo410@example.co.za",
    "firstName": "Itumeleng",
    "lastName": "Moyo",
    "phone": "+27 76 657 3776",
    "address": {
      "line1": "54 De Korte Street, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.769608,
      "lng": 28.238465
    }
  },
  {
    "id": "cust-0411",
    "email": "tendai.govender411@example.co.za",
    "firstName": "Tendai",
    "lastName": "Govender",
    "phone": "+27 76 191 2288",
    "address": {
      "line1": "378 Charles Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.008844,
      "lng": 28.012471
    }
  },
  {
    "id": "cust-0412",
    "email": "jan.du randt412@example.co.za",
    "firstName": "Jan",
    "lastName": "Du Randt",
    "phone": "+27 79 946 4568",
    "address": {
      "line1": "130 Lynnwood Road, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.859989,
      "lng": 28.183443
    }
  },
  {
    "id": "cust-0413",
    "email": "zanele.dlamini413@example.co.za",
    "firstName": "Zanele",
    "lastName": "Dlamini",
    "phone": "+27 83 779 4840",
    "address": {
      "line1": "237 Fehrsen Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.149691,
      "lng": 28.080138
    }
  },
  {
    "id": "cust-0414",
    "email": "mpho.gumbo414@example.co.za",
    "firstName": "Mpho",
    "lastName": "Gumbo",
    "phone": "+27 82 610 8991",
    "address": {
      "line1": "161 4th Avenue, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.998859,
      "lng": 28.119594
    }
  },
  {
    "id": "cust-0415",
    "email": "tshepo.gumede415@example.co.za",
    "firstName": "Tshepo",
    "lastName": "Gumede",
    "phone": "+27 83 729 3577",
    "address": {
      "line1": "95 Lynnwood Road, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.015322,
      "lng": 28.020108
    }
  },
  {
    "id": "cust-0416",
    "email": "lindiwe.phiri416@example.co.za",
    "firstName": "Lindiwe",
    "lastName": "Phiri",
    "phone": "+27 84 392 2820",
    "address": {
      "line1": "317 William Nicol Drive, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.154148,
      "lng": 28.082749
    }
  },
  {
    "id": "cust-0417",
    "email": "claire.molefe417@example.co.za",
    "firstName": "Claire",
    "lastName": "Molefe",
    "phone": "+27 79 720 2610",
    "address": {
      "line1": "389 William Nicol Drive, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.160037,
      "lng": 28.068598
    }
  },
  {
    "id": "cust-0418",
    "email": "tanya.van der merwe418@example.co.za",
    "firstName": "Tanya",
    "lastName": "Van Der Merwe",
    "phone": "+27 82 103 3501",
    "address": {
      "line1": "5 Jan Smuts Avenue, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.151873,
      "lng": 28.086032
    }
  },
  {
    "id": "cust-0419",
    "email": "craig.pillay419@example.co.za",
    "firstName": "Craig",
    "lastName": "Pillay",
    "phone": "+27 83 997 3717",
    "address": {
      "line1": "142 Fehrsen Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.134946,
      "lng": 28.02043
    }
  },
  {
    "id": "cust-0420",
    "email": "craig.pillay420@example.co.za",
    "firstName": "Craig",
    "lastName": "Pillay",
    "phone": "+27 76 223 7146",
    "address": {
      "line1": "13 Rivonia Road, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.763745,
      "lng": 28.245418
    }
  },
  {
    "id": "cust-0421",
    "email": "dineo.gxilishe421@example.co.za",
    "firstName": "Dineo",
    "lastName": "Gxilishe",
    "phone": "+27 84 570 1343",
    "address": {
      "line1": "161 Lynnwood Road, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.774009,
      "lng": 28.281249
    }
  },
  {
    "id": "cust-0422",
    "email": "farai.adams422@example.co.za",
    "firstName": "Farai",
    "lastName": "Adams",
    "phone": "+27 84 493 4531",
    "address": {
      "line1": "14 Grant Avenue, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.999552,
      "lng": 28.116514
    }
  },
  {
    "id": "cust-0423",
    "email": "boitumelo.coetzee423@example.co.za",
    "firstName": "Boitumelo",
    "lastName": "Coetzee",
    "phone": "+27 83 616 1598",
    "address": {
      "line1": "233 Rivonia Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.13815,
      "lng": 28.041985
    }
  },
  {
    "id": "cust-0424",
    "email": "jacques.du plessis424@example.co.za",
    "firstName": "Jacques",
    "lastName": "Du Plessis",
    "phone": "+27 76 927 3101",
    "address": {
      "line1": "412 Stanley Street, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.764298,
      "lng": 28.230092
    }
  },
  {
    "id": "cust-0425",
    "email": "mandla.moodley425@example.co.za",
    "firstName": "Mandla",
    "lastName": "Moodley",
    "phone": "+27 83 382 2261",
    "address": {
      "line1": "231 Juta Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.129231,
      "lng": 28.015836
    }
  },
  {
    "id": "cust-0426",
    "email": "lebohang.naidoo426@example.co.za",
    "firstName": "Lebohang",
    "lastName": "Naidoo",
    "phone": "+27 84 702 9967",
    "address": {
      "line1": "448 7th Street, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.165517,
      "lng": 28.004834
    }
  },
  {
    "id": "cust-0427",
    "email": "reneilwe.sibanda427@example.co.za",
    "firstName": "Reneilwe",
    "lastName": "Sibanda",
    "phone": "+27 76 877 5776",
    "address": {
      "line1": "160 Lynnwood Road, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.007104,
      "lng": 28.132594
    }
  },
  {
    "id": "cust-0428",
    "email": "katlego.mthembu428@example.co.za",
    "firstName": "Katlego",
    "lastName": "Mthembu",
    "phone": "+27 76 362 2908",
    "address": {
      "line1": "194 Sandton Drive, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.998652,
      "lng": 28.129328
    }
  },
  {
    "id": "cust-0429",
    "email": "kefilwe.fourie429@example.co.za",
    "firstName": "Kefilwe",
    "lastName": "Fourie",
    "phone": "+27 72 179 2253",
    "address": {
      "line1": "60 Charles Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.775114,
      "lng": 28.270598
    }
  },
  {
    "id": "cust-0430",
    "email": "christo.naidoo430@example.co.za",
    "firstName": "Christo",
    "lastName": "Naidoo",
    "phone": "+27 79 118 6367",
    "address": {
      "line1": "154 William Nicol Drive, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.197296,
      "lng": 28.026688
    }
  },
  {
    "id": "cust-0431",
    "email": "zola.reddy431@example.co.za",
    "firstName": "Zola",
    "lastName": "Reddy",
    "phone": "+27 84 133 3472",
    "address": {
      "line1": "202 Oxford Road, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.988479,
      "lng": 28.122124
    }
  },
  {
    "id": "cust-0432",
    "email": "katlego.grobbelaar432@example.co.za",
    "firstName": "Katlego",
    "lastName": "Grobbelaar",
    "phone": "+27 84 548 2456",
    "address": {
      "line1": "267 Grant Avenue, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.004307,
      "lng": 28.132109
    }
  },
  {
    "id": "cust-0433",
    "email": "tendai.visser433@example.co.za",
    "firstName": "Tendai",
    "lastName": "Visser",
    "phone": "+27 83 151 1875",
    "address": {
      "line1": "243 Jan Smuts Avenue, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.75664,
      "lng": 28.235109
    }
  },
  {
    "id": "cust-0434",
    "email": "neo.zulu434@example.co.za",
    "firstName": "Neo",
    "lastName": "Zulu",
    "phone": "+27 79 297 9952",
    "address": {
      "line1": "107 Lynnwood Road, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.758681,
      "lng": 28.228757
    }
  },
  {
    "id": "cust-0435",
    "email": "neo.ncube435@example.co.za",
    "firstName": "Neo",
    "lastName": "Ncube",
    "phone": "+27 76 609 7575",
    "address": {
      "line1": "20 Oxford Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.143263,
      "lng": 28.044403
    }
  },
  {
    "id": "cust-0436",
    "email": "mpho.du randt436@example.co.za",
    "firstName": "Mpho",
    "lastName": "Du Randt",
    "phone": "+27 82 675 7300",
    "address": {
      "line1": "278 Juta Street, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.863302,
      "lng": 28.191489
    }
  },
  {
    "id": "cust-0437",
    "email": "nthabiseng.adams437@example.co.za",
    "firstName": "Nthabiseng",
    "lastName": "Adams",
    "phone": "+27 82 552 1349",
    "address": {
      "line1": "207 Stanley Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.786424,
      "lng": 28.27616
    }
  },
  {
    "id": "cust-0438",
    "email": "katlego.van wyk438@example.co.za",
    "firstName": "Katlego",
    "lastName": "Van Wyk",
    "phone": "+27 83 961 5611",
    "address": {
      "line1": "69 Juta Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.776448,
      "lng": 28.274911
    }
  },
  {
    "id": "cust-0439",
    "email": "hendrik.khumalo439@example.co.za",
    "firstName": "Hendrik",
    "lastName": "Khumalo",
    "phone": "+27 84 491 1641",
    "address": {
      "line1": "109 7th Street, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.145049,
      "lng": 28.046361
    }
  },
  {
    "id": "cust-0440",
    "email": "jacques.molefe440@example.co.za",
    "firstName": "Jacques",
    "lastName": "Molefe",
    "phone": "+27 84 598 1663",
    "address": {
      "line1": "354 Grant Avenue, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.014874,
      "lng": 28.010567
    }
  },
  {
    "id": "cust-0441",
    "email": "rajesh.fourie441@example.co.za",
    "firstName": "Rajesh",
    "lastName": "Fourie",
    "phone": "+27 72 405 2563",
    "address": {
      "line1": "264 Grant Avenue, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.19403,
      "lng": 28.040067
    }
  },
  {
    "id": "cust-0442",
    "email": "keabetswe.van wyk442@example.co.za",
    "firstName": "Keabetswe",
    "lastName": "Van Wyk",
    "phone": "+27 72 199 8899",
    "address": {
      "line1": "36 De Korte Street, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.785149,
      "lng": 28.273659
    }
  },
  {
    "id": "cust-0443",
    "email": "themba.zuma443@example.co.za",
    "firstName": "Themba",
    "lastName": "Zuma",
    "phone": "+27 72 137 7893",
    "address": {
      "line1": "396 Jan Smuts Avenue, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.162597,
      "lng": 28.077911
    }
  },
  {
    "id": "cust-0444",
    "email": "willem.zuma444@example.co.za",
    "firstName": "Willem",
    "lastName": "Zuma",
    "phone": "+27 83 440 4433",
    "address": {
      "line1": "5 Duncan Street, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.777675,
      "lng": 28.242105
    }
  },
  {
    "id": "cust-0445",
    "email": "willem.zulu445@example.co.za",
    "firstName": "Willem",
    "lastName": "Zulu",
    "phone": "+27 84 398 8074",
    "address": {
      "line1": "358 Main Road, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.859267,
      "lng": 28.185617
    }
  },
  {
    "id": "cust-0446",
    "email": "johan.nel446@example.co.za",
    "firstName": "Johan",
    "lastName": "Nel",
    "phone": "+27 83 667 8040",
    "address": {
      "line1": "183 7th Street, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.154462,
      "lng": 28.038625
    }
  },
  {
    "id": "cust-0447",
    "email": "francois.hendricks447@example.co.za",
    "firstName": "Francois",
    "lastName": "Hendricks",
    "phone": "+27 79 767 8219",
    "address": {
      "line1": "41 Sandton Drive, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.77945,
      "lng": 28.277557
    }
  },
  {
    "id": "cust-0448",
    "email": "tanya.singh448@example.co.za",
    "firstName": "Tanya",
    "lastName": "Singh",
    "phone": "+27 76 789 5166",
    "address": {
      "line1": "27 Oxford Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.14157,
      "lng": 28.033267
    }
  },
  {
    "id": "cust-0449",
    "email": "anisha.sibanda449@example.co.za",
    "firstName": "Anisha",
    "lastName": "Sibanda",
    "phone": "+27 83 988 8104",
    "address": {
      "line1": "17 Fehrsen Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.148734,
      "lng": 28.079243
    }
  },
  {
    "id": "cust-0450",
    "email": "reneilwe.ross450@example.co.za",
    "firstName": "Reneilwe",
    "lastName": "Ross",
    "phone": "+27 84 186 1921",
    "address": {
      "line1": "224 Rivonia Road, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.173521,
      "lng": 27.998558
    }
  },
  {
    "id": "cust-0451",
    "email": "preetha.sithole451@example.co.za",
    "firstName": "Preetha",
    "lastName": "Sithole",
    "phone": "+27 79 172 6174",
    "address": {
      "line1": "241 4th Avenue, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.749124,
      "lng": 28.236143
    }
  },
  {
    "id": "cust-0452",
    "email": "bulelwa.van der merwe452@example.co.za",
    "firstName": "Bulelwa",
    "lastName": "Van Der Merwe",
    "phone": "+27 82 802 5084",
    "address": {
      "line1": "197 Sandton Drive, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.755981,
      "lng": 28.247198
    }
  },
  {
    "id": "cust-0453",
    "email": "cobus.ross453@example.co.za",
    "firstName": "Cobus",
    "lastName": "Ross",
    "phone": "+27 84 197 9540",
    "address": {
      "line1": "402 4th Avenue, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.104955,
      "lng": 28.06424
    }
  },
  {
    "id": "cust-0454",
    "email": "farai.visser454@example.co.za",
    "firstName": "Farai",
    "lastName": "Visser",
    "phone": "+27 76 947 8099",
    "address": {
      "line1": "401 Fehrsen Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.994998,
      "lng": 28.134978
    }
  },
  {
    "id": "cust-0455",
    "email": "marike.adams455@example.co.za",
    "firstName": "Marike",
    "lastName": "Adams",
    "phone": "+27 84 707 4981",
    "address": {
      "line1": "122 Main Road, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.170867,
      "lng": 27.998424
    }
  },
  {
    "id": "cust-0456",
    "email": "stephan.moyo456@example.co.za",
    "firstName": "Stephan",
    "lastName": "Moyo",
    "phone": "+27 72 499 1076",
    "address": {
      "line1": "426 Lynnwood Road, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.751018,
      "lng": 28.241337
    }
  },
  {
    "id": "cust-0457",
    "email": "johan.hendricks457@example.co.za",
    "firstName": "Johan",
    "lastName": "Hendricks",
    "phone": "+27 79 113 7940",
    "address": {
      "line1": "357 Lynnwood Road, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.186856,
      "lng": 28.027406
    }
  },
  {
    "id": "cust-0458",
    "email": "jan.ndlovu458@example.co.za",
    "firstName": "Jan",
    "lastName": "Ndlovu",
    "phone": "+27 79 403 4795",
    "address": {
      "line1": "93 Juta Street, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.143262,
      "lng": 28.019553
    }
  },
  {
    "id": "cust-0459",
    "email": "preetha.mokoena459@example.co.za",
    "firstName": "Preetha",
    "lastName": "Mokoena",
    "phone": "+27 84 793 9529",
    "address": {
      "line1": "146 De Korte Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.010778,
      "lng": 28.002883
    }
  },
  {
    "id": "cust-0460",
    "email": "refilwe.miller460@example.co.za",
    "firstName": "Refilwe",
    "lastName": "Miller",
    "phone": "+27 82 970 2698",
    "address": {
      "line1": "409 Juta Street, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.858467,
      "lng": 28.18546
    }
  },
  {
    "id": "cust-0461",
    "email": "rajesh.sibanda461@example.co.za",
    "firstName": "Rajesh",
    "lastName": "Sibanda",
    "phone": "+27 84 491 1525",
    "address": {
      "line1": "411 Lynnwood Road, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.18293,
      "lng": 28.002719
    }
  },
  {
    "id": "cust-0462",
    "email": "johan.zuma462@example.co.za",
    "firstName": "Johan",
    "lastName": "Zuma",
    "phone": "+27 72 778 4898",
    "address": {
      "line1": "312 Duncan Street, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.759501,
      "lng": 28.245509
    }
  },
  {
    "id": "cust-0463",
    "email": "farai.nel463@example.co.za",
    "firstName": "Farai",
    "lastName": "Nel",
    "phone": "+27 79 520 7373",
    "address": {
      "line1": "407 Juta Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.151696,
      "lng": 28.076673
    }
  },
  {
    "id": "cust-0464",
    "email": "zanele.van wyk464@example.co.za",
    "firstName": "Zanele",
    "lastName": "Van Wyk",
    "phone": "+27 84 671 1172",
    "address": {
      "line1": "23 Fehrsen Street, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.111339,
      "lng": 28.061055
    }
  },
  {
    "id": "cust-0465",
    "email": "claire.botha465@example.co.za",
    "firstName": "Claire",
    "lastName": "Botha",
    "phone": "+27 82 156 2184",
    "address": {
      "line1": "323 Duncan Street, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.867953,
      "lng": 28.191951
    }
  },
  {
    "id": "cust-0466",
    "email": "puleng.nel466@example.co.za",
    "firstName": "Puleng",
    "lastName": "Nel",
    "phone": "+27 82 261 9964",
    "address": {
      "line1": "200 De Korte Street, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.76491,
      "lng": 28.236578
    }
  },
  {
    "id": "cust-0467",
    "email": "gareth.govender467@example.co.za",
    "firstName": "Gareth",
    "lastName": "Govender",
    "phone": "+27 76 643 9735",
    "address": {
      "line1": "132 Rivonia Road, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.752156,
      "lng": 28.239696
    }
  },
  {
    "id": "cust-0468",
    "email": "hendrik.pretorius468@example.co.za",
    "firstName": "Hendrik",
    "lastName": "Pretorius",
    "phone": "+27 83 424 7386",
    "address": {
      "line1": "30 Church Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.995202,
      "lng": 28.11714
    }
  },
  {
    "id": "cust-0469",
    "email": "kefilwe.pillay469@example.co.za",
    "firstName": "Kefilwe",
    "lastName": "Pillay",
    "phone": "+27 83 794 7472",
    "address": {
      "line1": "89 Oxford Road, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.012776,
      "lng": 28.00321
    }
  },
  {
    "id": "cust-0470",
    "email": "sipho.robinson470@example.co.za",
    "firstName": "Sipho",
    "lastName": "Robinson",
    "phone": "+27 76 106 6216",
    "address": {
      "line1": "137 Charles Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -25.988647,
      "lng": 28.127173
    }
  },
  {
    "id": "cust-0471",
    "email": "themba.ncube471@example.co.za",
    "firstName": "Themba",
    "lastName": "Ncube",
    "phone": "+27 76 385 8506",
    "address": {
      "line1": "184 Jan Smuts Avenue, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.179413,
      "lng": 28.012511
    }
  },
  {
    "id": "cust-0472",
    "email": "willem.pretorius472@example.co.za",
    "firstName": "Willem",
    "lastName": "Pretorius",
    "phone": "+27 82 918 5897",
    "address": {
      "line1": "374 4th Avenue, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.13326,
      "lng": 28.025501
    }
  },
  {
    "id": "cust-0473",
    "email": "nomsa.reddy473@example.co.za",
    "firstName": "Nomsa",
    "lastName": "Reddy",
    "phone": "+27 84 561 5613",
    "address": {
      "line1": "337 Church Street, Melville",
      "suburb": "Melville",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2092",
      "lat": -26.169278,
      "lng": 28.00242
    }
  },
  {
    "id": "cust-0474",
    "email": "ayanda.ross474@example.co.za",
    "firstName": "Ayanda",
    "lastName": "Ross",
    "phone": "+27 84 637 2541",
    "address": {
      "line1": "183 Atterbury Road, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.151455,
      "lng": 28.077397
    }
  },
  {
    "id": "cust-0475",
    "email": "marike.sibanda475@example.co.za",
    "firstName": "Marike",
    "lastName": "Sibanda",
    "phone": "+27 82 334 2239",
    "address": {
      "line1": "5 Lynnwood Road, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.00953,
      "lng": 28.013184
    }
  },
  {
    "id": "cust-0476",
    "email": "zanele.matlala476@example.co.za",
    "firstName": "Zanele",
    "lastName": "Matlala",
    "phone": "+27 83 808 4926",
    "address": {
      "line1": "133 Grant Avenue, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.013917,
      "lng": 28.009672
    }
  },
  {
    "id": "cust-0477",
    "email": "nandi.chetty477@example.co.za",
    "firstName": "Nandi",
    "lastName": "Chetty",
    "phone": "+27 79 881 4494",
    "address": {
      "line1": "327 Lynnwood Road, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.858992,
      "lng": 28.197331
    }
  },
  {
    "id": "cust-0478",
    "email": "claire.dlamini478@example.co.za",
    "firstName": "Claire",
    "lastName": "Dlamini",
    "phone": "+27 83 542 2497",
    "address": {
      "line1": "182 Atterbury Road, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.137051,
      "lng": 28.023994
    }
  },
  {
    "id": "cust-0479",
    "email": "themba.van wyk479@example.co.za",
    "firstName": "Themba",
    "lastName": "Van Wyk",
    "phone": "+27 82 546 1157",
    "address": {
      "line1": "275 Stanley Street, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.74443,
      "lng": 28.24236
    }
  },
  {
    "id": "cust-0480",
    "email": "boitumelo.steyn480@example.co.za",
    "firstName": "Boitumelo",
    "lastName": "Steyn",
    "phone": "+27 76 817 2363",
    "address": {
      "line1": "18 Rivonia Road, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.859993,
      "lng": 28.191547
    }
  },
  {
    "id": "cust-0481",
    "email": "zola.van der merwe481@example.co.za",
    "firstName": "Zola",
    "lastName": "Van Der Merwe",
    "phone": "+27 82 341 3671",
    "address": {
      "line1": "305 Rivonia Road, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.749191,
      "lng": 28.234162
    }
  },
  {
    "id": "cust-0482",
    "email": "lindiwe.gxilishe482@example.co.za",
    "firstName": "Lindiwe",
    "lastName": "Gxilishe",
    "phone": "+27 84 376 9304",
    "address": {
      "line1": "163 Oxford Road, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.141883,
      "lng": 28.021919
    }
  },
  {
    "id": "cust-0483",
    "email": "riaan.gumede483@example.co.za",
    "firstName": "Riaan",
    "lastName": "Gumede",
    "phone": "+27 76 144 2149",
    "address": {
      "line1": "5 Duncan Street, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.151123,
      "lng": 28.037777
    }
  },
  {
    "id": "cust-0484",
    "email": "boitumelo.daniels484@example.co.za",
    "firstName": "Boitumelo",
    "lastName": "Daniels",
    "phone": "+27 82 332 2763",
    "address": {
      "line1": "223 Oxford Road, Parkhurst",
      "suburb": "Parkhurst",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2193",
      "lat": -26.134916,
      "lng": 28.019524
    }
  },
  {
    "id": "cust-0485",
    "email": "dirk.grobbelaar485@example.co.za",
    "firstName": "Dirk",
    "lastName": "Grobbelaar",
    "phone": "+27 79 898 8367",
    "address": {
      "line1": "97 Grant Avenue, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.191544,
      "lng": 28.024981
    }
  },
  {
    "id": "cust-0486",
    "email": "willem.singh486@example.co.za",
    "firstName": "Willem",
    "lastName": "Singh",
    "phone": "+27 72 363 9852",
    "address": {
      "line1": "137 De Korte Street, Midrand Central",
      "suburb": "Midrand Central",
      "city": "Midrand",
      "province": "Gauteng",
      "postalCode": "1685",
      "lat": -26.000649,
      "lng": 28.129656
    }
  },
  {
    "id": "cust-0487",
    "email": "willem.singh487@example.co.za",
    "firstName": "Willem",
    "lastName": "Singh",
    "phone": "+27 83 215 5771",
    "address": {
      "line1": "238 Grant Avenue, Hatfield",
      "suburb": "Hatfield",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0083",
      "lat": -25.754094,
      "lng": 28.238211
    }
  },
  {
    "id": "cust-0488",
    "email": "claire.fourie488@example.co.za",
    "firstName": "Claire",
    "lastName": "Fourie",
    "phone": "+27 83 911 4348",
    "address": {
      "line1": "377 Stanley Street, Braamfontein",
      "suburb": "Braamfontein",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2001",
      "lat": -26.193779,
      "lng": 28.036481
    }
  },
  {
    "id": "cust-0489",
    "email": "mpho.molefe489@example.co.za",
    "firstName": "Mpho",
    "lastName": "Molefe",
    "phone": "+27 76 273 4471",
    "address": {
      "line1": "265 Main Road, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.779939,
      "lng": 28.272316
    }
  },
  {
    "id": "cust-0490",
    "email": "reneilwe.sithole490@example.co.za",
    "firstName": "Reneilwe",
    "lastName": "Sithole",
    "phone": "+27 79 590 9696",
    "address": {
      "line1": "198 7th Street, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.159589,
      "lng": 28.079057
    }
  },
  {
    "id": "cust-0491",
    "email": "preetha.claassen491@example.co.za",
    "firstName": "Preetha",
    "lastName": "Claassen",
    "phone": "+27 83 116 3245",
    "address": {
      "line1": "402 Oxford Road, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.781655,
      "lng": 28.268151
    }
  },
  {
    "id": "cust-0492",
    "email": "tumelo.singh492@example.co.za",
    "firstName": "Tumelo",
    "lastName": "Singh",
    "phone": "+27 82 475 1007",
    "address": {
      "line1": "239 William Nicol Drive, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.856958,
      "lng": 28.17989
    }
  },
  {
    "id": "cust-0493",
    "email": "rajesh.snyman493@example.co.za",
    "firstName": "Rajesh",
    "lastName": "Snyman",
    "phone": "+27 82 256 2537",
    "address": {
      "line1": "404 7th Street, Brooklyn",
      "suburb": "Brooklyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0181",
      "lat": -25.77447,
      "lng": 28.237296
    }
  },
  {
    "id": "cust-0494",
    "email": "tumelo.hendricks494@example.co.za",
    "firstName": "Tumelo",
    "lastName": "Hendricks",
    "phone": "+27 83 913 2058",
    "address": {
      "line1": "23 Sandton Drive, Norwood",
      "suburb": "Norwood",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2192",
      "lat": -26.155038,
      "lng": 28.085624
    }
  },
  {
    "id": "cust-0495",
    "email": "annelize.maharaj495@example.co.za",
    "firstName": "Annelize",
    "lastName": "Maharaj",
    "phone": "+27 82 669 5459",
    "address": {
      "line1": "359 Duncan Street, Fourways",
      "suburb": "Fourways",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2055",
      "lat": -26.021673,
      "lng": 28.007913
    }
  },
  {
    "id": "cust-0496",
    "email": "rajesh.robinson496@example.co.za",
    "firstName": "Rajesh",
    "lastName": "Robinson",
    "phone": "+27 82 713 8295",
    "address": {
      "line1": "256 Jan Smuts Avenue, Sandton CBD",
      "suburb": "Sandton CBD",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.117402,
      "lng": 28.048161
    }
  },
  {
    "id": "cust-0497",
    "email": "katlego.pillay497@example.co.za",
    "firstName": "Katlego",
    "lastName": "Pillay",
    "phone": "+27 84 301 6789",
    "address": {
      "line1": "440 Fehrsen Street, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.154496,
      "lng": 28.047635
    }
  },
  {
    "id": "cust-0498",
    "email": "gareth.zuma498@example.co.za",
    "firstName": "Gareth",
    "lastName": "Zuma",
    "phone": "+27 72 555 5828",
    "address": {
      "line1": "25 Atterbury Road, Rosebank",
      "suburb": "Rosebank",
      "city": "Johannesburg",
      "province": "Gauteng",
      "postalCode": "2196",
      "lat": -26.142051,
      "lng": 28.031818
    }
  },
  {
    "id": "cust-0499",
    "email": "ayanda.phiri499@example.co.za",
    "firstName": "Ayanda",
    "lastName": "Phiri",
    "phone": "+27 79 763 5970",
    "address": {
      "line1": "53 4th Avenue, Menlyn",
      "suburb": "Menlyn",
      "city": "Pretoria",
      "province": "Gauteng",
      "postalCode": "0081",
      "lat": -25.792554,
      "lng": 28.281285
    }
  },
  {
    "id": "cust-0500",
    "email": "zola.grobbelaar500@example.co.za",
    "firstName": "Zola",
    "lastName": "Grobbelaar",
    "phone": "+27 79 681 5436",
    "address": {
      "line1": "153 Stanley Street, Centurion Central",
      "suburb": "Centurion Central",
      "city": "Centurion",
      "province": "Gauteng",
      "postalCode": "0157",
      "lat": -25.854194,
      "lng": 28.188416
    }
  }
];
