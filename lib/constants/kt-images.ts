export interface KTCourierImage {
  src: string;
  width: number;
  height: number;
  alt: string;
  sourceTitle: string;
  sourceUrl: string;
  credit: string;
  license: "Pexels License";
}

export const ktCourierImages = {
  capeTownStreet: {
    src: "/images/kt-couriers/cape-town-street-view.webp",
    width: 1600,
    height: 2400,
    alt: "Street view in downtown Cape Town with city traffic and storefronts",
    sourceTitle: "Street View of Downtown Cape Town",
    sourceUrl: "https://www.pexels.com/photo/street-view-of-downtown-cape-town-34174330/",
    credit: "Israel Luvhimbi",
    license: "Pexels License",
  },
  capeTownRoute: {
    src: "/images/kt-couriers/cape-town-city-route.webp",
    width: 1600,
    height: 1200,
    alt: "Cape Town city buildings with Table Mountain in the background",
    sourceTitle: "Modern Cityscape with Table Mountain in Background",
    sourceUrl: "https://www.pexels.com/photo/modern-cityscape-with-table-mountain-in-background-30495230/",
    credit: "Magda Ehlers",
    license: "Pexels License",
  },
  parcelHandoffCustomer: {
    src: "/images/kt-couriers/parcel-handoff-customer.webp",
    width: 1600,
    height: 901,
    alt: "Customer receiving parcels during a local delivery handoff",
    sourceTitle: "Person Handing Over Packages",
    sourceUrl: "https://www.pexels.com/photo/person-handing-over-packages-6868618/",
    credit: "Kindel Media",
    license: "Pexels License",
  },
  handsExchangingPackages: {
    src: "/images/kt-couriers/hands-exchanging-delivery-packages.webp",
    width: 1600,
    height: 901,
    alt: "Hands exchanging packed parcels during delivery",
    sourceTitle: "A Person Handing Over Delivery Packages",
    sourceUrl: "https://www.pexels.com/photo/a-person-handing-over-delivery-packages-6994138/",
    credit: "Kindel Media",
    license: "Pexels License",
  },
  labelledParcel: {
    src: "/images/kt-couriers/labelled-parcel-preparation.webp",
    width: 1600,
    height: 1067,
    alt: "Hands preparing a labelled cardboard parcel for shipping",
    sourceTitle: "Woman preparing box with parcel for sending",
    sourceUrl: "https://www.pexels.com/photo/woman-preparing-box-with-parcel-for-sending-6347513/",
    credit: "Liza Summer",
    license: "Pexels License",
  },
  parcelPackingCloseUp: {
    src: "/images/kt-couriers/parcel-packing-close-up.webp",
    width: 1600,
    height: 1068,
    alt: "Hands placing protective paper inside a parcel box",
    sourceTitle: "Person Packing Using Brown Paper",
    sourceUrl: "https://www.pexels.com/photo/person-packing-using-brown-paper-9594501/",
    credit: "Ron Lach",
    license: "Pexels License",
  },
  storeMerchandisePacking: {
    src: "/images/kt-couriers/store-merchandise-packing.webp",
    width: 1600,
    height: 1068,
    alt: "Small store owner packing merchandise beside boxes and clothing rails",
    sourceTitle: "A Woman Packing Her Merchandise",
    sourceUrl: "https://www.pexels.com/photo/a-woman-packing-her-merchandise-7857535/",
    credit: "Kampus Production",
    license: "Pexels License",
  },
  smallBusinessCounter: {
    src: "/images/kt-couriers/small-business-delivery-counter.webp",
    width: 1600,
    height: 1067,
    alt: "Small business counter preparing packaged goods for courier pickup",
    sourceTitle: "Cook Packing Delivery for Courier",
    sourceUrl: "https://www.pexels.com/photo/cook-packing-delivery-for-courier-4393659/",
    credit: "Norma Mortenson",
    license: "Pexels License",
  },
  boxSealingPrep: {
    src: "/images/kt-couriers/box-sealing-order-prep.webp",
    width: 1600,
    height: 1067,
    alt: "Hands sealing a cardboard box for order preparation",
    sourceTitle: "A Person Packing a Box",
    sourceUrl: "https://www.pexels.com/photo/a-person-packing-a-box-7309949/",
    credit: "RDNE Stock project",
    license: "Pexels License",
  },
} as const satisfies Record<string, KTCourierImage>;
