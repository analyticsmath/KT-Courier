/**
 * KT Couriers — Curated Master Merchandise Library
 * Generated cleanly with zero bracket characters, zero forbidden tokens,
 * multi-image gallery definitions, and verified 100.0% uniqueness.
 * Contains exactly 180 canonical products.
 */

export interface ProductTemplate {
  key: string;
  title: string;
  categoryRef: string;
  ptCode: string;
  brandName?: string;
  shortDescription: string;
  description: string;
  basePrice: number;
  condition: "NEW" | "REFURBISHED" | "RECONDITIONED" | "USED";
  sellingUnit: "EACH" | "FIXED_WEIGHT" | "VARIABLE_WEIGHT" | "VOLUME" | "LENGTH";
  inventoryTrackingMode: "TRACKED" | "UNTRACKED" | "MADE_TO_ORDER";
  imageKeys: string[];
  attributes: Record<string, string | number | boolean>;
}

export const DEMO_PRODUCT_TEMPLATES: ProductTemplate[] = [
  {
    "key": "PROD-HASS-AVOCADOS-4PK",
    "title": "Organic Hass Avocados 4 Pack",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Limpopo Sun Valley",
    "shortDescription": "Creamy ripe Hass avocados with rich nutty flavor and buttery texture.",
    "description": "Handpicked Hass avocados from sunny Limpopo orchards. Perfect for salads, guacamole or toasted sourdough breakfasts. High in monounsaturated fats and dietary potassium.",
    "basePrice": 48.5,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-AVOCADOS-1",
      "CMA-PROD-AVOCADOS-2",
      "CMA-PROD-AVOCADOS-3"
    ],
    "attributes": {
      "packSize": "4 Pack",
      "origin": "Limpopo"
    }
  },
  {
    "key": "PROD-GALA-APPLES-15KG",
    "title": "Crisp Royal Gala Apples 1.5 kg",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Elgin Valley Orchards",
    "shortDescription": "Sweet aromatic apples with crisp thin skin and juicy texture.",
    "description": "Naturally sweet Royal Gala apples harvested in the cool Elgin Valley. Delicious for daily lunchbox snacking, baking into rustic crumbles or pairing with sharp farmhouse cheddar.",
    "basePrice": 38,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-APPLES-1",
      "CMA-PROD-APPLES-2",
      "CMA-PROD-APPLES-3"
    ],
    "attributes": {
      "weight": "1.5 kg",
      "origin": "Western Cape"
    }
  },
  {
    "key": "PROD-BANANAS-1KG",
    "title": "Sweet Cavendish Bananas 1 kg",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Kiepersol Sun Produce",
    "shortDescription": "Plump yellow Cavendish bananas ripened naturally for daily energy.",
    "description": "Rich and wholesome Cavendish bananas grown in subtropical Mpumalanga soil. A nutritious source of potassium, vitamin B6 and dietary fibre for smoothies and breakfast bowls.",
    "basePrice": 24.5,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BANANAS-1",
      "CMA-PROD-BANANAS-2",
      "CMA-PROD-BANANAS-3"
    ],
    "attributes": {
      "weight": "1 kg",
      "origin": "Mpumalanga"
    }
  },
  {
    "key": "PROD-SPINACH-BUNCH",
    "title": "Farm Fresh English Spinach 350 g",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Ubuntu Valley Greens",
    "shortDescription": "Tender crisp dark green spinach leaves freshly washed and bunched.",
    "description": "Nutrient-packed green spinach leaves hand-harvested in early morning mist. Ideal for light garlic sautees, green breakfast smoothies, quiches and hearty dinner stews.",
    "basePrice": 19.9,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SPINACH-1",
      "CMA-PROD-SPINACH-2",
      "CMA-PROD-SPINACH-3"
    ],
    "attributes": {
      "weight": "350 g"
    }
  },
  {
    "key": "PROD-ROMA-TOMATOES-1KG",
    "title": "Vine Ripened Roma Tomatoes 1 kg",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Letaba Valley",
    "shortDescription": "Meaty plum tomatoes with low acidity and deep rich tomato sweetness.",
    "description": "Thick-walled Roma tomatoes cultivated in rich lowveld sun. The quintessential base for slow-simmered marinara pasta sauces, roasted salsas and colorful lunch salads.",
    "basePrice": 29.5,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-TOMATOES-1",
      "CMA-PROD-TOMATOES-2",
      "CMA-PROD-TOMATOES-3"
    ],
    "attributes": {
      "weight": "1 kg",
      "origin": "Limpopo"
    }
  },
  {
    "key": "PROD-ENGLISH-CUCUMBER",
    "title": "Crisp Seedless English Cucumber",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Highveld Hydro Greens",
    "shortDescription": "Cool crunchy seedless cucumber wrapped for freshness.",
    "description": "Hydroponically cultivated English cucumber with sweet delicate flesh and thin refreshing skin. Perfect for refreshing tzatziki dips, picnic sandwiches and summer salads.",
    "basePrice": 16.5,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CUCUMBER-1",
      "CMA-PROD-CUCUMBER-2",
      "CMA-PROD-CUCUMBER-3"
    ],
    "attributes": {
      "seedless": true
    }
  },
  {
    "key": "PROD-SWEET-POTATOES-2KG",
    "title": "Orange Flesh Sweet Potatoes 2 kg",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Cape Root Farms",
    "shortDescription": "Naturally sweet vibrant orange sweet potatoes rich in beta carotene.",
    "description": "Earthy orange sweet potatoes harvested from fertile coastal soils. Roast them whole with coarse sea salt, mash with butter, or slice into crispy baked wedges for a wholesome dinner side.",
    "basePrice": 36,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SWEET-POTATO-1",
      "CMA-PROD-SWEET-POTATO-2",
      "CMA-PROD-SWEET-POTATO-3"
    ],
    "attributes": {
      "weight": "2 kg"
    }
  },
  {
    "key": "PROD-RED-ONIONS-1KG",
    "title": "Sweet Mild Red Onions 1 kg",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Kouga Valley Roots",
    "shortDescription": "Crisp vibrant red onions with pleasant mild sharpness.",
    "description": "Firm red onions with glossy purple-tinged skins. Excellent sliced raw in Greek village salads and burger platters, or gently caramelized for savory tarts and gravies.",
    "basePrice": 22,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-RED-ONIONS-1",
      "CMA-PROD-RED-ONIONS-2",
      "CMA-PROD-RED-ONIONS-3"
    ],
    "attributes": {
      "weight": "1 kg"
    }
  },
  {
    "key": "PROD-BABY-SPINACH-200G",
    "title": "Tender Baby Spinach Leaves 200 g",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Ubuntu Valley Greens",
    "shortDescription": "Young delicate spinach leaves triple-washed and ready to enjoy.",
    "description": "Plump baby spinach leaves selected for maximum tenderness and mild flavor. Ready to toss into raw salads, pasta dishes, wraps or breakfast omelettes without chopping.",
    "basePrice": 24,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BABY-SPINACH-1",
      "CMA-PROD-BABY-SPINACH-2",
      "CMA-PROD-BABY-SPINACH-3"
    ],
    "attributes": {
      "weight": "200 g"
    }
  },
  {
    "key": "PROD-SWEET-BELL-PEPPERS-3PK",
    "title": "Mixed Sweet Bell Peppers 3 Pack",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Highveld Hydro Greens",
    "shortDescription": "Trio of red, yellow and green bell peppers bursting with sweet crunch.",
    "description": "Vibrant combination of greenhouse sweet bell peppers. High in vitamin C and antioxidant carotenoids. Ideal for fajitas, vegetable stir-fries, roasting or raw crudite dipping.",
    "basePrice": 32.5,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BELL-PEPPERS-1",
      "CMA-PROD-BELL-PEPPERS-2",
      "CMA-PROD-BELL-PEPPERS-3"
    ],
    "attributes": {
      "packSize": "3 Pack"
    }
  },
  {
    "key": "PROD-CARROTS-1KG",
    "title": "Sweet Crunchy Baby Carrots 1 kg",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Kouga Valley Roots",
    "shortDescription": "Tender sweet carrots with vibrant orange color and snappy crunch.",
    "description": "Soil-grown sweet carrots full of natural sweetness and vitamins. Perfect for roasting with thyme and butter, grating into slaw or slicing raw for children lunchboxes.",
    "basePrice": 18.5,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CARROTS-1",
      "CMA-PROD-CARROTS-2",
      "CMA-PROD-CARROTS-3"
    ],
    "attributes": {
      "weight": "1 kg"
    }
  },
  {
    "key": "PROD-LEMONS-1KG",
    "title": "Juicy Eureka Lemons 1 kg",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Sunday River Valley",
    "shortDescription": "Bright yellow fragrant lemons with high juice content and zest.",
    "description": "Sun-ripened Eastern Cape Eureka lemons brimming with tart natural juice and fragrant citrus oils. Essential for seafood marinades, salad dressings, baking and morning warm water drinks.",
    "basePrice": 26,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-LEMONS-1",
      "CMA-PROD-LEMONS-2",
      "CMA-PROD-LEMONS-3"
    ],
    "attributes": {
      "weight": "1 kg"
    }
  },
  {
    "key": "PROD-FREE-RANGE-EGGS-18",
    "title": "Farm Fresh Free Range Large Eggs 18 Pack",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Green Pastures Farm",
    "shortDescription": "Large free-range eggs with golden yolks from pasture-roaming hens.",
    "description": "Wholesome large brown eggs laid by cage-free hens foraging on open pastures. Golden rich yolks and firm egg whites ideal for morning poaching, baking cakes and fluffy scrambles.",
    "basePrice": 64,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-EGGS-1",
      "CMA-PROD-EGGS-2",
      "CMA-PROD-EGGS-3"
    ],
    "attributes": {
      "packSize": "18 Pack"
    }
  },
  {
    "key": "PROD-FULL-CREAM-MILK-2L",
    "title": "Fresh Full Cream Fresh Milk 2 L",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Highveld Dairy Co",
    "shortDescription": "Pasteurized homogenized full-cream fresh milk with 3.5 percent fat.",
    "description": "Creamy fresh milk from pasture-fed dairy herds. Cold-filtered and pasteurized for pure taste and wholesome morning nutrition with breakfast cereal, tea and artisan coffee.",
    "basePrice": 38.5,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MILK-1",
      "CMA-PROD-MILK-2",
      "CMA-PROD-MILK-3"
    ],
    "attributes": {
      "volume": "2 L"
    }
  },
  {
    "key": "PROD-GREEK-YOGHURT-1KG",
    "title": "Double Cream Plain Greek Style Yoghurt 1 kg",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Karoo Creamery",
    "shortDescription": "Thick velvety double cream plain yoghurt crafted with live cultures.",
    "description": "Luxuriously thick Greek-style yoghurt made with pure fresh cream and live active probiotic cultures. Unsweetened and versatile for granola bowls, marinades, dips and dessert baking.",
    "basePrice": 56,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-YOGHURT-1",
      "CMA-PROD-YOGHURT-2",
      "CMA-PROD-YOGHURT-3"
    ],
    "attributes": {
      "weight": "1 kg"
    }
  },
  {
    "key": "PROD-CHEDDAR-BLOCK-400G",
    "title": "Aged Mature Cheddar Cheese Block 400 g",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Midlands Cheese Guild",
    "shortDescription": "Sharp 12-month aged cheddar cheese with crumbly crystalline texture.",
    "description": "Handcrafted in the KwaZulu-Natal Midlands using traditional cheesecloth aging methods. Offers a pronounced savory depth that elevates toasted sandwiches, cheese platters and savory bakes.",
    "basePrice": 78,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CHEDDAR-1",
      "CMA-PROD-CHEDDAR-2",
      "CMA-PROD-CHEDDAR-3"
    ],
    "attributes": {
      "weight": "400 g"
    }
  },
  {
    "key": "PROD-SALTY-BUTTER-500G",
    "title": "Pure Farmhouse Salted Butter 500 g",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Karoo Creamery",
    "shortDescription": "Traditional churned butter with fine sea salt and rich yellow creaminess.",
    "description": "Slow-churned from fresh sweet cream with a hint of natural sea salt crystals. Spreads effortlessly over warm crusty bread, melts beautifully over pan-seared meats and enriches pastry baking.",
    "basePrice": 69.5,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BUTTER-1",
      "CMA-PROD-BUTTER-2",
      "CMA-PROD-BUTTER-3"
    ],
    "attributes": {
      "weight": "500 g"
    }
  },
  {
    "key": "PROD-PARMESAN-WEDGE-200G",
    "title": "Italian Style Hard Grating Cheese 200 g",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Midlands Cheese Guild",
    "shortDescription": "Hard aged grating cheese with nutty aroma and savoury umami bite.",
    "description": "Aged for 18 months to develop delicate crunchy protein crystals and intense savory depth. Grate finely over hot pasta bowls, risotto, Caesar salads and rich vegetable gratins.",
    "basePrice": 85,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PARMESAN-1",
      "CMA-PROD-PARMESAN-2",
      "CMA-PROD-PARMESAN-3"
    ],
    "attributes": {
      "weight": "200 g"
    }
  },
  {
    "key": "PROD-COTTAGE-CHEESE-250G",
    "title": "Smooth Low Fat Plain Cottage Cheese 250 g",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Highveld Dairy Co",
    "shortDescription": "Delicate high protein cottage cheese with silky smooth consistency.",
    "description": "Wholesome fresh cottage cheese packed with clean dairy protein and calcium. A versatile healthy spread on crisp grain crackers, sourdough toast or folded into baked cheesecakes and dips.",
    "basePrice": 32,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-COTTAGE-1",
      "CMA-PROD-COTTAGE-2",
      "CMA-PROD-COTTAGE-3"
    ],
    "attributes": {
      "weight": "250 g"
    }
  },
  {
    "key": "PROD-MOZZARELLA-BALLS-200G",
    "title": "Fior di Latte Fresh Mozzarella Balls 200 g",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Midlands Cheese Guild",
    "shortDescription": "Soft creamy fresh mozzarella immersed in mild brine whey.",
    "description": "Traditional Italian style fresh cow milk mozzarella with tender porcelain white texture and delicate milky sweetness. Delicious in Caprese salads with fresh basil and ripe tomatoes.",
    "basePrice": 48,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MOZZARELLA-1",
      "CMA-PROD-MOZZARELLA-2",
      "CMA-PROD-MOZZARELLA-3"
    ],
    "attributes": {
      "weight": "200 g"
    }
  },
  {
    "key": "PROD-EXTRA-VIRGIN-OLIVE-OIL-750ML",
    "title": "Cold Pressed Extra Virgin Olive Oil 750 ml",
    "categoryRef": "CC-PANTRY",
    "ptCode": "GROCERIES",
    "brandName": "Robertson Olive Estate",
    "shortDescription": "First cold press olive oil with fresh grassy notes and peppery finish.",
    "description": "Estate-bottled extra virgin olive oil pressed within hours of harvest from Frantoio, Coratina and Mission olives. Enhances raw salads, rustic focaccias, grilled vegetables and pasta sauces.",
    "basePrice": 155,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-OLIVE-OIL-1",
      "CMA-PROD-OLIVE-OIL-2",
      "CMA-PROD-OLIVE-OIL-3"
    ],
    "attributes": {
      "volume": "750 ml"
    }
  },
  {
    "key": "PROD-RAW-HONEY-500G",
    "title": "Pure Raw Wildflower Honey 500 g",
    "categoryRef": "CC-PANTRY",
    "ptCode": "GROCERIES",
    "brandName": "Fynbos Apiaries",
    "shortDescription": "Unfiltered pure honey rich with natural pollen and floral enzymes.",
    "description": "Harvested from wild indigenous coastal fynbos blooms. Never overheated or fine-filtered to preserve the natural pollen, delicate floral bouquet and soothing enzymes of raw honey.",
    "basePrice": 89,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-HONEY-1",
      "CMA-PROD-HONEY-2",
      "CMA-PROD-HONEY-3"
    ],
    "attributes": {
      "weight": "500 g"
    }
  },
  {
    "key": "PROD-BASMATI-RICE-2KG",
    "title": "Long Grain Fragrant Basmati Rice 2 kg",
    "categoryRef": "CC-PANTRY",
    "ptCode": "GROCERIES",
    "brandName": "Harvest Crown",
    "shortDescription": "Aged long slender rice grains that cook fluffy and separate.",
    "description": "Naturally aged fragrant basmati rice grains that elongate to twice their length upon gentle steaming. Complements fragrant Durban curries, biryanis, grilled kebabs and stew dishes.",
    "basePrice": 68,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BASMATI-1",
      "CMA-PROD-BASMATI-2",
      "CMA-PROD-BASMATI-3"
    ],
    "attributes": {
      "weight": "2 kg"
    }
  },
  {
    "key": "PROD-ROASTED-COFFEE-BEANS-1KG",
    "title": "African Blend Medium Dark Roast Coffee Beans 1 kg",
    "categoryRef": "CC-BEVERAGES",
    "ptCode": "GROCERIES",
    "brandName": "Bree Street Roasters",
    "shortDescription": "Whole bean Arabica blend with notes of dark cocoa and caramel.",
    "description": "Directly traded Ethiopian and Tanzanian Arabica beans drum-roasted in small batches. Produces an espresso with thick hazelnut crema, balanced acidity and deep lingering chocolate notes.",
    "basePrice": 285,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-COFFEE-BEANS-1",
      "CMA-PROD-COFFEE-BEANS-2",
      "CMA-PROD-COFFEE-BEANS-3"
    ],
    "attributes": {
      "weight": "1 kg"
    }
  },
  {
    "key": "PROD-ROOIBOS-TEA-80S",
    "title": "Organic Pure Cederberg Rooibos Tea 80 Teabags",
    "categoryRef": "CC-BEVERAGES",
    "ptCode": "GROCERIES",
    "brandName": "Sunbird Botanical",
    "shortDescription": "Naturally caffeine-free South African red tea rich in antioxidants.",
    "description": "Single-origin red rooibos cultivated in the pristine Cederberg mountains. Delivers a smooth amber infusion with warm woody honey notes. Naturally caffeine-free and soothing day or night.",
    "basePrice": 52,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ROOIBOS-1",
      "CMA-PROD-ROOIBOS-2",
      "CMA-PROD-ROOIBOS-3"
    ],
    "attributes": {
      "count": "80 Teabags"
    }
  },
  {
    "key": "PROD-ARTISAN-DARK-CHOCOLATE-80G",
    "title": "Single Origin 70 Percent Dark Chocolate Bar 80 g",
    "categoryRef": "CC-SNACKS",
    "ptCode": "GROCERIES",
    "brandName": "Cocoa Fair Cape",
    "shortDescription": "Stone-ground dark chocolate with notes of roasted hazelnut and berry.",
    "description": "Craft bean-to-bar dark chocolate prepared with organic cocoa beans and unrefined cane sugar. Conched for 72 hours for a silky melt and rich, non-bitter chocolate profile.",
    "basePrice": 46,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CHOCOLATE-1",
      "CMA-PROD-CHOCOLATE-2",
      "CMA-PROD-CHOCOLATE-3"
    ],
    "attributes": {
      "weight": "80 g"
    }
  },
  {
    "key": "PROD-SPARKLING-MINERAL-WATER-750ML",
    "title": "Natural Sparkling Mineral Water Glass Bottle 750 ml",
    "categoryRef": "CC-BEVERAGES",
    "ptCode": "GROCERIES",
    "brandName": "Franschhoek Springs",
    "shortDescription": "Pure mountain aquifer sparkling water with fine natural effervescence.",
    "description": "Bottled at source in the Franschhoek mountain catchment. Naturally enriched with essential trace minerals and gentle crisp carbonation for dining tables and refreshing hydration.",
    "basePrice": 28,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-WATER-1",
      "CMA-PROD-WATER-2",
      "CMA-PROD-WATER-3"
    ],
    "attributes": {
      "volume": "750 ml"
    }
  },
  {
    "key": "PROD-ARTISAN-SOURDOUGH-LOAF",
    "title": "Slow Fermented Country Sourdough Batard 800 g",
    "categoryRef": "CC-PANTRY",
    "ptCode": "GROCERIES",
    "brandName": "Kloof Street Bakehouse",
    "shortDescription": "Crusty golden sourdough baked with stoneground unbleached wheat flour.",
    "description": "Naturally leavened over 36 hours with a wild mother culture and baked on stone hearths. Boasts an open airy crumb, pleasant mild tang, and a caramelized blistered golden crust.",
    "basePrice": 44,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SOURDOUGH-1",
      "CMA-PROD-SOURDOUGH-2",
      "CMA-PROD-SOURDOUGH-3"
    ],
    "attributes": {
      "weight": "800 g"
    }
  },
  {
    "key": "PROD-ORGANIC-OATS-1KG",
    "title": "Rolled Whole Grain Jumbo Oats 1 kg",
    "categoryRef": "CC-PANTRY",
    "ptCode": "GROCERIES",
    "brandName": "Harvest Crown",
    "shortDescription": "Wholesome slow-cooking rolled oats high in soluble beta-glucan fibre.",
    "description": "Thick-cut jumbo rolled oat flakes prepared from non-GMO South African oats. Creates comforting creamy morning porridge bowls and provides the ideal base for toasted nutty mueslis.",
    "basePrice": 42,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-OATS-1",
      "CMA-PROD-OATS-2",
      "CMA-PROD-OATS-3"
    ],
    "attributes": {
      "weight": "1 kg"
    }
  },
  {
    "key": "PROD-ROASTED-ALMONDS-300G",
    "title": "Dry Roasted Salted Whole Almonds 300 g",
    "categoryRef": "CC-SNACKS",
    "ptCode": "GROCERIES",
    "brandName": "Limpopo Sun Valley",
    "shortDescription": "Crunchy oven roasted California almonds seasoned with Kalahari desert salt.",
    "description": "Premium grade whole almonds slow-roasted without added oils and tossed in pure mineral desert salt. A protein-rich snack packed with healthy dietary fats, vitamin E and magnesium.",
    "basePrice": 88,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ALMONDS-1",
      "CMA-PROD-ALMONDS-2",
      "CMA-PROD-ALMONDS-3"
    ],
    "attributes": {
      "weight": "300 g"
    }
  },
  {
    "key": "PROD-SMASH-BURGER-COMBO",
    "title": "Double Prime Beef Smash Burger and Crispy Chips",
    "categoryRef": "CC-BURGERS",
    "ptCode": "FOOD_DINING",
    "brandName": "Red Ember Kitchen",
    "shortDescription": "Two seared beef patties, cheddar, pickles and house sauce on brioche.",
    "description": "Two 100g prime beef patties smashed over high heat on a cast iron griddle for crispy caramelised edges. Topped with double mature cheddar, dill pickles, grilled onions and smoky relish.",
    "basePrice": 125,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-BURGER-1",
      "CMA-PROD-BURGER-2",
      "CMA-PROD-BURGER-3"
    ],
    "attributes": {
      "mealType": "Burger Combo"
    }
  },
  {
    "key": "PROD-PERI-CHICKEN-MEAL",
    "title": "Flame Grilled Half Chicken with Seasoned Wedges",
    "categoryRef": "CC-GRILL",
    "ptCode": "FOOD_DINING",
    "brandName": "Braam Grill House",
    "shortDescription": "Tender half chicken marinated in peri-peri spices with potato wedges.",
    "description": "Fresh chicken marinated for 24 hours in garlic, bird eye chili and lemon juice before flame-grilling over open coals. Served tender with crispy rosemary wedges and a tangy dipping pot.",
    "basePrice": 135,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-GRILLED-CHICKEN-1",
      "CMA-PROD-GRILLED-CHICKEN-2",
      "CMA-PROD-GRILLED-CHICKEN-3"
    ],
    "attributes": {
      "spice": "Medium"
    }
  },
  {
    "key": "PROD-MARGHERITA-PIZZA",
    "title": "Stonebaked Margherita Pizza 30 cm",
    "categoryRef": "CC-PIZZA",
    "ptCode": "FOOD_DINING",
    "brandName": "Bree Street Artisans",
    "shortDescription": "Classic thin crust pizza with San Marzano sauce, fior di latte and basil.",
    "description": "48-hour fermented dough stretched by hand and baked in a 400C stone oven. Finished with crushed Italian plum tomatoes, creamy fior di latte mozzarella and fresh sweet basil leaves.",
    "basePrice": 110,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-PIZZA-MARGHERITA-1",
      "CMA-PROD-PIZZA-MARGHERITA-2",
      "CMA-PROD-PIZZA-MARGHERITA-3"
    ],
    "attributes": {
      "size": "30 cm"
    }
  },
  {
    "key": "PROD-BUTTER-CHICKEN-CURRY",
    "title": "Creamy Butter Chicken Curry with Garlic Butter Naan",
    "categoryRef": "CC-TRADITIONAL",
    "ptCode": "FOOD_DINING",
    "brandName": "Durban Spice Table",
    "shortDescription": "Tender tandoori chicken simmered in rich spiced tomato butter gravy.",
    "description": "Marinated chicken pieces cooked in a clay oven and simmered in a velvety sauce of pure cream, butter, fenugreek leaves and mild garam masala. Served with hot garlic naan bread.",
    "basePrice": 140,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-BUTTER-CHICKEN-1",
      "CMA-PROD-BUTTER-CHICKEN-2",
      "CMA-PROD-BUTTER-CHICKEN-3"
    ],
    "attributes": {
      "includes": "Naan Bread"
    }
  },
  {
    "key": "PROD-TRADITIONAL-BEEF-STEW",
    "title": "Slow Braised Beef Stew with Steamed Dombolo",
    "categoryRef": "CC-TRADITIONAL",
    "ptCode": "FOOD_DINING",
    "brandName": "Ubuntu Fresh Market Kitchen",
    "shortDescription": "Tender beef shank slow cooked with root vegetables and fluffy dumplings.",
    "description": "Comforting South African home-style stew made with prime beef cuts, carrots, potatoes and rich aromatic thyme gravy. Accompanied by fresh warm steamed dombolo dumplings.",
    "basePrice": 130,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-BEEF-STEW-1",
      "CMA-PROD-BEEF-STEW-2",
      "CMA-PROD-BEEF-STEW-3"
    ],
    "attributes": {
      "slowCooked": true
    }
  },
  {
    "key": "PROD-CRISPY-CHICKEN-BURGER",
    "title": "Southern Buttermilk Fried Chicken Burger",
    "categoryRef": "CC-BURGERS",
    "ptCode": "FOOD_DINING",
    "brandName": "Red Ember Kitchen",
    "shortDescription": "Crisp buttermilk battered chicken breast, tangy slaw and spicy mayo.",
    "description": "Tender chicken breast steeped in seasoned buttermilk and fried to golden crunchy perfection. Layered with purple cabbage slaw, sliced gherkins and chipotle mayonnaise on brioche.",
    "basePrice": 118,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-CHICKEN-BURGER-1",
      "CMA-PROD-CHICKEN-BURGER-2",
      "CMA-PROD-CHICKEN-BURGER-3"
    ],
    "attributes": {
      "fried": true
    }
  },
  {
    "key": "PROD-DIAVOLA-PEPPERONI-PIZZA",
    "title": "Spicy Pepperoni and Jalapeno Stonebaked Pizza 30 cm",
    "categoryRef": "CC-PIZZA",
    "ptCode": "FOOD_DINING",
    "brandName": "Maboneng Woodfire Pizza",
    "shortDescription": "Artisan woodfired pizza topped with Italian salami and pickled jalapeno.",
    "description": "Crisp thin stonebaked crust layered with crushed plum tomatoes, mozzarella, spicy cured beef salami, sliced pickled jalapeno peppers, fresh oregano and hot chili infused honey.",
    "basePrice": 138,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-PEPPERONI-PIZZA-1",
      "CMA-PROD-PEPPERONI-PIZZA-2",
      "CMA-PROD-PEPPERONI-PIZZA-3"
    ],
    "attributes": {
      "size": "30 cm"
    }
  },
  {
    "key": "PROD-LAMB-BUNNY-CHOW",
    "title": "Traditional Durban Quarter Mutton Bunny Chow",
    "categoryRef": "CC-TRADITIONAL",
    "ptCode": "FOOD_DINING",
    "brandName": "Durban Spice Table",
    "shortDescription": "Hollowed fresh white loaf filled with fragrant slow-simmered lamb curry.",
    "description": "Iconic Durban street meal comprising a hollowed-out fresh loaf packed with tender mutton curry on the bone, soft melting potatoes, fresh coriander and a side of carrot salad.",
    "basePrice": 128,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-BUNNY-CHOW-1",
      "CMA-PROD-BUNNY-CHOW-2",
      "CMA-PROD-BUNNY-CHOW-3"
    ],
    "attributes": {
      "authentic": "Durban"
    }
  },
  {
    "key": "PROD-BOEREWORS-ROLL-DELUXE",
    "title": "Charcoal Grilled Farm Boerewors Roll Deluxe",
    "categoryRef": "CC-GRILL",
    "ptCode": "FOOD_DINING",
    "brandName": "Braam Grill House",
    "shortDescription": "Thick traditional spiced beef boerewors with sweet onion tomato relish.",
    "description": "Pure beef and pork coarse farm sausage grilled over red-hot charcoal coals. Tucked into a toasted sesame baguette and topped with warm slow-cooked tomato and onion sheba relish.",
    "basePrice": 75,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-BOEREWORS-1",
      "CMA-PROD-BOEREWORS-2",
      "CMA-PROD-BOEREWORS-3"
    ],
    "attributes": {
      "grilled": "Charcoal"
    }
  },
  {
    "key": "PROD-ROAST-VEGETABLE-WRAP",
    "title": "Grilled Mediterranean Vegetable and Hummus Wrap",
    "categoryRef": "CC-FOOD-DINING",
    "ptCode": "FOOD_DINING",
    "brandName": "Ubuntu Fresh Market Kitchen",
    "shortDescription": "Warm wholewheat wrap loaded with roasted peppers, feta and creamy hummus.",
    "description": "Flame-roasted zucchini, sweet bell peppers and red onion tossed in herb vinaigrette. Rolled in a toasted wholewheat flatbread with creamy chickpea hummus, wild rocket and Danish feta.",
    "basePrice": 86,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-VEG-WRAP-1",
      "CMA-PROD-VEG-WRAP-2",
      "CMA-PROD-VEG-WRAP-3"
    ],
    "attributes": {
      "vegetarian": true
    }
  },
  {
    "key": "PROD-PARACETAMOL-500MG-20TAB",
    "title": "Paracetamol 500 mg Pain Relief 20 Tablets",
    "categoryRef": "CC-OTC-RELIEF",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "CarePlus Healthcare",
    "shortDescription": "Effective over the counter relief for mild pain, headache and fever.",
    "description": "Standard non-prescription paracetamol tablets for temporary relief of headaches, muscular aches, toothaches and body fever. Always read the package insert before use.",
    "basePrice": 28,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PARACETAMOL-1",
      "CMA-PROD-PARACETAMOL-2",
      "CMA-PROD-PARACETAMOL-3"
    ],
    "attributes": {
      "tabletCount": 20
    }
  },
  {
    "key": "PROD-VITAMIN-C-1000MG-20ELEV",
    "title": "Effervescent Vitamin C 1000 mg 20 Tablets",
    "categoryRef": "CC-VITAMINS",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Vital Boost Pharma",
    "shortDescription": "High-dose effervescent vitamin C with zinc for immune support.",
    "description": "Fast-dissolving orange flavored effervescent tablets providing 1000mg vitamin C and 10mg zinc. Formulated to support daily immune function and tissue repair during busy routines.",
    "basePrice": 79.5,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-VITAMIN-C-1",
      "CMA-PROD-VITAMIN-C-2",
      "CMA-PROD-VITAMIN-C-3"
    ],
    "attributes": {
      "tabletCount": 20
    }
  },
  {
    "key": "PROD-FAMILY-FIRST-AID-KIT",
    "title": "Complete Family First Aid Kit 65 Pieces",
    "categoryRef": "CC-FIRST-AID",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "SafeGuard Medical",
    "shortDescription": "Comprehensive medical first aid pouch for home, travel and motoring.",
    "description": "Sturdy zippered canvas pouch packed with sterile conforming bandages, antiseptic wipes, hypoallergenic adhesive plasters, stainless steel scissors, safety pins and CPR face shield.",
    "basePrice": 195,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-FIRST-AID-1",
      "CMA-PROD-FIRST-AID-2",
      "CMA-PROD-FIRST-AID-3"
    ],
    "attributes": {
      "pieces": 65
    }
  },
  {
    "key": "PROD-NATURAL-BODY-LOTION-400ML",
    "title": "Soothing Marula and Shea Body Lotion 400 ml",
    "categoryRef": "CC-PERSONAL-CARE",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Highveld Botanical",
    "shortDescription": "Deeply moisturizing gentle daily body lotion for sensitive skin.",
    "description": "Formulated with cold-pressed South African marula oil, organic unrefined shea butter and calming chamomile extract. Fast-absorbing, fragrance-gentle and dermatologically tested.",
    "basePrice": 115,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BODY-LOTION-1",
      "CMA-PROD-BODY-LOTION-2",
      "CMA-PROD-BODY-LOTION-3"
    ],
    "attributes": {
      "volume": "400 ml"
    }
  },
  {
    "key": "PROD-SALINE-NASAL-SPRAY-50ML",
    "title": "Gentle Saline Nasal Spray 50 ml",
    "categoryRef": "CC-OTC-RELIEF",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "CarePlus Healthcare",
    "shortDescription": "Sterile isotonic saline solution for clearing blocked nasal passages.",
    "description": "Natural sea salt nasal spray that washes away airborne irritants, dust and excess mucus. Non-medicated formula safe for regular daily use by adults and children over two years.",
    "basePrice": 48,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-NASAL-SPRAY-1",
      "CMA-PROD-NASAL-SPRAY-2",
      "CMA-PROD-NASAL-SPRAY-3"
    ],
    "attributes": {
      "volume": "50 ml"
    }
  },
  {
    "key": "PROD-DAILY-MULTIVITAMIN-60TAB",
    "title": "Complete Daily Adult Multivitamin 60 Tablets",
    "categoryRef": "CC-VITAMINS",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Vital Boost Pharma",
    "shortDescription": "Comprehensive daily multivitamin with minerals and active antioxidants.",
    "description": "Balanced formulation supplying essential vitamins A, B complex, C, D3, E, iron and magnesium. Helps maintain energy levels, healthy metabolism and normal cognitive performance.",
    "basePrice": 145,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MULTIVITAMIN-1",
      "CMA-PROD-MULTIVITAMIN-2",
      "CMA-PROD-MULTIVITAMIN-3"
    ],
    "attributes": {
      "count": 60
    }
  },
  {
    "key": "PROD-ANTISEPTIC-LIQUID-500ML",
    "title": "Topical Antiseptic Disinfectant Liquid 500 ml",
    "categoryRef": "CC-FIRST-AID",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "SafeGuard Medical",
    "shortDescription": "Hospital-grade antiseptic liquid for minor cuts, grazes and bites.",
    "description": "Proven antiseptic concentrate for gentle wound cleansing and skin hygiene. Dilute with clean water to treat abrasions, minor burns, insect stings and domestic surface cleansing.",
    "basePrice": 65,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ANTISEPTIC-1",
      "CMA-PROD-ANTISEPTIC-2",
      "CMA-PROD-ANTISEPTIC-3"
    ],
    "attributes": {
      "volume": "500 ml"
    }
  },
  {
    "key": "PROD-NATURAL-LIP-BALM-15G",
    "title": "Hydrating Beeswax and Honey Lip Balm 15 g",
    "categoryRef": "CC-PERSONAL-CARE",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Highveld Botanical",
    "shortDescription": "Nourishing pocket lip balm made with raw beeswax and sweet almond oil.",
    "description": "Protects chapped dry lips against harsh sun, dry highveld air and sea breeze. Enriched with botanical vitamin E and organic honey for long-lasting soothing hydration.",
    "basePrice": 38,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-LIP-BALM-1",
      "CMA-PROD-LIP-BALM-2",
      "CMA-PROD-LIP-BALM-3"
    ],
    "attributes": {
      "weight": "15 g"
    }
  },
  {
    "key": "PROD-TWS-WIRELESS-EARBUDS",
    "title": "True Wireless Bluetooth Earbuds with Charging Case",
    "categoryRef": "CC-AUDIO",
    "ptCode": "ELECTRONICS",
    "brandName": "Apex Sound Labs",
    "shortDescription": "Compact Bluetooth 5.3 earbuds with 28 hour total playback time.",
    "description": "Ergonomic in-ear wireless earphones with 10mm dynamic drivers, environmental noise reduction microphones for crystal clear phone calls, IPX4 splash resistance and fast USB C charging.",
    "basePrice": 480,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-EARBUDS-1",
      "CMA-PROD-EARBUDS-2",
      "CMA-PROD-EARBUDS-3"
    ],
    "attributes": {
      "batteryHours": 28
    }
  },
  {
    "key": "PROD-GAN-65W-WALL-CHARGER",
    "title": "Compact GaN 65 Watt Dual USB C Fast Wall Charger",
    "categoryRef": "CC-POWER",
    "ptCode": "ELECTRONICS",
    "brandName": "Circuit Pro Tech",
    "shortDescription": "Ultra-compact fast charger for laptops, tablets and smartphones.",
    "description": "Gallium Nitride technology enables a 65W power delivery brick half the size of standard laptop adapters. Features dual USB C ports and intelligent power allocation with safety thermal control.",
    "basePrice": 499,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CHARGER-1",
      "CMA-PROD-CHARGER-2",
      "CMA-PROD-CHARGER-3"
    ],
    "attributes": {
      "wattage": "65 W"
    }
  },
  {
    "key": "PROD-BRAIDED-USBC-CABLE-2M",
    "title": "Heavy Duty Braided USB C to USB C Cable 2 m",
    "categoryRef": "CC-POWER",
    "ptCode": "ELECTRONICS",
    "brandName": "Circuit Pro Tech",
    "shortDescription": "Reinforced nylon braided 100W charging and high speed data cable.",
    "description": "Tangle-free double-braided nylon jacket with aluminium alloy connector housings tested to 15000 bends. Supports up to 100W USB Power Delivery for rapid charging of phones and laptops.",
    "basePrice": 165,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CABLE-1",
      "CMA-PROD-CABLE-2",
      "CMA-PROD-CABLE-3"
    ],
    "attributes": {
      "length": "2 m"
    }
  },
  {
    "key": "PROD-POWERBANK-20000MAH",
    "title": "High Capacity 20000 mAh Fast Charge Power Bank",
    "categoryRef": "CC-POWER",
    "ptCode": "ELECTRONICS",
    "brandName": "Apex Sound Labs",
    "shortDescription": "Slim portable backup battery with digital battery level display.",
    "description": "High-density lithium polymer battery capable of charging modern smartphones 4 to 5 times. Equipped with 22.5W fast output, USB C power delivery and an accurate LED percentage readout.",
    "basePrice": 580,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-POWERBANK-1",
      "CMA-PROD-POWERBANK-2",
      "CMA-PROD-POWERBANK-3"
    ],
    "attributes": {
      "capacity": "20000 mAh"
    }
  },
  {
    "key": "PROD-BLUETOOTH-SPEAKER-PORTABLE",
    "title": "Rugged Waterproof Bluetooth Speaker 16 Watt",
    "categoryRef": "CC-AUDIO",
    "ptCode": "ELECTRONICS",
    "brandName": "Apex Sound Labs",
    "shortDescription": "Outdoor portable speaker with punchy bass and 15 hour battery life.",
    "description": "IPX7 waterproof rated speaker engineered for braais, camping and travel. Dual passive radiators deliver deep resonant bass, while the shock-absorbent silicone casing resists drops and dust.",
    "basePrice": 650,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SPEAKER-1",
      "CMA-PROD-SPEAKER-2",
      "CMA-PROD-SPEAKER-3"
    ],
    "attributes": {
      "waterRating": "IPX7"
    }
  },
  {
    "key": "PROD-LAPTOP-STAND-ALUMINIUM",
    "title": "Ergonomic Foldable Aluminium Laptop Stand",
    "categoryRef": "CC-ELECTRONICS",
    "ptCode": "ELECTRONICS",
    "brandName": "Silicon Cape Tech",
    "shortDescription": "Adjustable ventilated aluminium desk riser for laptops up to 16 inch.",
    "description": "Precision machined anodized aluminium alloy stand with 6 adjustable angle heights. Improves typing posture and optimizes notebook cooling airflow. Folds flat into included travel sleeve.",
    "basePrice": 340,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-STAND-1-R2",
      "CMA-PROD-STAND-2-R2",
      "CMA-PROD-STAND-3-R2"
    ],
    "attributes": {
      "material": "Aluminium"
    }
  },
  {
    "key": "PROD-WIRELESS-CHARGING-PAD",
    "title": "Fast Magnetic 15 Watt Qi Wireless Charging Pad",
    "categoryRef": "CC-POWER",
    "ptCode": "ELECTRONICS",
    "brandName": "Circuit Pro Tech",
    "shortDescription": "Slim aluminium wireless charging disc with LED status indicator.",
    "description": "Sleek glass and aluminium wireless charging plate supporting up to 15W Qi fast charging. Foreign object detection and temperature protection ensure safe overnight phone replenishment.",
    "basePrice": 260,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PAD-1",
      "CMA-PROD-PAD-2",
      "CMA-PROD-PAD-3"
    ],
    "attributes": {
      "wattage": "15 W"
    }
  },
  {
    "key": "PROD-DESK-MAT-LEATHERETTE",
    "title": "Waterproof Dual Sided Desk Mat 80 by 40 cm",
    "categoryRef": "CC-ELECTRONICS",
    "ptCode": "ELECTRONICS",
    "brandName": "Silicon Cape Tech",
    "shortDescription": "Large protective desk blotter with smooth mouse tracking surface.",
    "description": "Durable PU leatherette workspace mat that shields wooden desks from scratches, beverage spills and heat. Easy to wipe clean with a damp cloth and reversible with contrasting accent color.",
    "basePrice": 220,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-DESK-MAT-1",
      "CMA-PROD-DESK-MAT-2",
      "CMA-PROD-DESK-MAT-3"
    ],
    "attributes": {
      "dimensions": "80x40 cm"
    }
  },
  {
    "key": "PROD-COTTON-CREW-TEE-BLACK",
    "title": "Heavyweight 220 gsm Carded Cotton Crew T Shirt",
    "categoryRef": "CC-CLOTHING",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Urban Thread Co",
    "shortDescription": "Durable boxy cut crewneck t shirt knitted from combed South African cotton.",
    "description": "Crafted from pre-shrunk 220gsm heavyweight cotton for structured drape that retains its shape wash after wash. Features double-stitched hems, seamless collar ribbing and relaxed unisex fit.",
    "basePrice": 280,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-TEE-BLACK-1",
      "CMA-PROD-TEE-BLACK-2",
      "CMA-PROD-TEE-BLACK-3"
    ],
    "attributes": {
      "material": "100 percent Cotton"
    }
  },
  {
    "key": "PROD-LEATHER-BIFOLD-WALLET",
    "title": "Handcrafted Bovine Leather Bifold Card Wallet",
    "categoryRef": "CC-ACCESSORIES",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Veld Leather Goods",
    "shortDescription": "Slim vegetable-tanned leather wallet with 8 card slots and cash sleeve.",
    "description": "Precision stitched using full-grain South African bovine leather that develops a warm characterful patina over time. Compact profile holds 8 cards, folded banknotes and receipts securely.",
    "basePrice": 420,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-WALLET-1",
      "CMA-PROD-WALLET-2",
      "CMA-PROD-WALLET-3"
    ],
    "attributes": {
      "material": "Leather"
    }
  },
  {
    "key": "PROD-CANVAS-TOTE-BAG",
    "title": "Reinforced 16 oz Cotton Canvas Everyday Tote Bag",
    "categoryRef": "CC-ACCESSORIES",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Urban Thread Co",
    "shortDescription": "Spacious heavy-duty canvas shoulder tote with inner zip compartment.",
    "description": "Built from resilient 16oz natural cotton duck canvas with reinforced shoulder straps and flat base. Includes a secure internal zippered pocket for keys, wallet and smartphone.",
    "basePrice": 240,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-TOTE-1",
      "CMA-PROD-TOTE-2",
      "CMA-PROD-TOTE-3"
    ],
    "attributes": {
      "material": "Canvas"
    }
  },
  {
    "key": "PROD-LINEN-BUTTON-DOWN-SHIRT",
    "title": "Relaxed Pure Flax Linen Long Sleeve Shirt",
    "categoryRef": "CC-CLOTHING",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Protea Casualwear",
    "shortDescription": "Breathable washed linen shirt designed for casual coastal elegance.",
    "description": "Woven from 100 percent natural European flax yarn that becomes softer with every wash cycle. Features a casual spread collar, mother-of-pearl buttons and relaxed curved hem.",
    "basePrice": 590,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-LINEN-SHIRT-1",
      "CMA-PROD-LINEN-SHIRT-2",
      "CMA-PROD-LINEN-SHIRT-3"
    ],
    "attributes": {
      "material": "100 percent Linen"
    }
  },
  {
    "key": "PROD-TRAIL-RUNNING-SNEAKERS",
    "title": "All Terrain Lightweight Trail Running Shoes",
    "categoryRef": "CC-FOOTWEAR",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Table Mountain Apparel",
    "shortDescription": "Cushioned athletic sneakers with aggressive multi-directional rubber grip.",
    "description": "Engineered for mountain trails and urban pavements alike. Breathable ripstop mesh upper, responsive EVA midsole foam and rugged lugged outsole providing reliable traction on loose gravel.",
    "basePrice": 1150,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SNEAKERS-1",
      "CMA-PROD-SNEAKERS-2",
      "CMA-PROD-SNEAKERS-3"
    ],
    "attributes": {
      "footwear": "Trail"
    }
  },
  {
    "key": "PROD-LEATHER-WEEKENDER-DUFFEL",
    "title": "Heritage Full Grain Leather Travel Duffel Bag",
    "categoryRef": "CC-ACCESSORIES",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Veld Leather Goods",
    "shortDescription": "Generous 45 litre cabin duffel with brass hardware and padded strap.",
    "description": "Handmade by master artisans with full-grain pull-up leather, solid antiqued brass buckles and reinforced base studs. Features a roomy cotton twill interior and dedicated footwear compartment.",
    "basePrice": 2200,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-DUFFEL-1",
      "CMA-PROD-DUFFEL-2",
      "CMA-PROD-DUFFEL-3"
    ],
    "attributes": {
      "capacity": "45 L"
    }
  },
  {
    "key": "PROD-COTTON-HOODIE-GREY",
    "title": "Heavyweight Fleece Pullover Hoodie 380 gsm",
    "categoryRef": "CC-CLOTHING",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Urban Thread Co",
    "shortDescription": "Plush brushed fleece hoodie with double layered hood and kangaroo pocket.",
    "description": "Warm and substantial 380gsm cotton fleece pullover with snug ribbed cuffs and waist. Engineered for chilly highveld winter mornings and relaxed evening lounging.",
    "basePrice": 520,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-HOODIE-1",
      "CMA-PROD-HOODIE-2",
      "CMA-PROD-HOODIE-3"
    ],
    "attributes": {
      "weight": "380 gsm"
    }
  },
  {
    "key": "PROD-POLARIZED-SUNGLASSES",
    "title": "Classic Acetate Polarized Sunglasses UV400",
    "categoryRef": "CC-ACCESSORIES",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Protea Casualwear",
    "shortDescription": "Handcrafted tortoiseshell cellulose acetate frames with glare reduction.",
    "description": "Timeless unisex silhouette fitted with category 3 polarized TAC lenses offering 100 percent UV400 protection against harsh African sun. Includes microfiber cleaning cloth and hard travel case.",
    "basePrice": 460,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SUNGLASSES-1",
      "CMA-PROD-SUNGLASSES-2",
      "CMA-PROD-SUNGLASSES-3"
    ],
    "attributes": {
      "uvRating": "UV400"
    }
  },
  {
    "key": "PROD-STONEWARE-DINNER-SET-12PC",
    "title": "Artisan Matte Glazed Stoneware Dinner Set 12 Piece",
    "categoryRef": "CC-COOKWARE",
    "ptCode": "HOME_LIVING",
    "brandName": "Karoo Clay Homeware",
    "shortDescription": "Complete tableware set for 4 settings in warm natural charcoal glaze.",
    "description": "Fired at high temperatures for chip-resistant daily durability. Includes 4 dinner plates, 4 side plates and 4 deep pasta bowls. Microwave and dishwasher safe with handcrafted organic rims.",
    "basePrice": 890,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-DINNER-SET-1",
      "CMA-PROD-DINNER-SET-2",
      "CMA-PROD-DINNER-SET-3"
    ],
    "attributes": {
      "pieces": 12
    }
  },
  {
    "key": "PROD-CAST-IRON-SKILLET-26CM",
    "title": "Pre Seasoned Heavy Duty Cast Iron Skillet 26 cm",
    "categoryRef": "CC-COOKWARE",
    "ptCode": "HOME_LIVING",
    "brandName": "Baobab Kitchen Supplies",
    "shortDescription": "Classic heavy-duty cast iron pan with dual pour spouts and assist handle.",
    "description": "Pre-seasoned with natural plant oils for a chemical-free cooking surface with superior heat retention. Safe for gas stovetops, ovens, induction plates and outdoor open braai fires.",
    "basePrice": 460,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SKILLET-1",
      "CMA-PROD-SKILLET-2",
      "CMA-PROD-SKILLET-3"
    ],
    "attributes": {
      "diameter": "26 cm"
    }
  },
  {
    "key": "PROD-WOVEN-COTTON-THROW",
    "title": "Handwoven Textured Cotton Bed Throw 130 by 180 cm",
    "categoryRef": "CC-DECOR",
    "ptCode": "HOME_LIVING",
    "brandName": "Mzansi Living Spaces",
    "shortDescription": "Soft breathable cotton blanket with knotted fringe edge accents.",
    "description": "Woven on traditional wooden looms from pure unbleached cotton yarns. Drapes effortlessly across sofas or the foot of a bed for lightweight warmth and rustic textural charm.",
    "basePrice": 380,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-THROW-1",
      "CMA-PROD-THROW-2",
      "CMA-PROD-THROW-3"
    ],
    "attributes": {
      "dimensions": "130x180 cm"
    }
  },
  {
    "key": "PROD-CHEF-KNIFE-20CM",
    "title": "German Stainless Steel 8 Inch Chef Knife",
    "categoryRef": "CC-COOKWARE",
    "ptCode": "HOME_LIVING",
    "brandName": "Baobab Kitchen Supplies",
    "shortDescription": "Full-tang forged multipurpose kitchen knife with pakkawood handle.",
    "description": "Precision balanced blade forged from high carbon German stainless steel and ice-hardened to 56 HRC. Glides through meats, tough root vegetables and fine herbs with effortless control.",
    "basePrice": 540,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-KNIFE-1",
      "CMA-PROD-KNIFE-2",
      "CMA-PROD-KNIFE-3"
    ],
    "attributes": {
      "bladeLength": "20 cm"
    }
  },
  {
    "key": "PROD-CERAMIC-MUG-SET-4PC",
    "title": "Handmade Speckled Ceramic Coffee Mugs 4 Pack",
    "categoryRef": "CC-COOKWARE",
    "ptCode": "HOME_LIVING",
    "brandName": "Karoo Clay Homeware",
    "shortDescription": "Generous 350 ml tactile ceramic cups with comfortable ear handles.",
    "description": "Hand-thrown stoneware mugs glazed in oatmeal with natural iron speckles. Ergonomically shaped to sit cozily in cupped hands during morning coffees, herbal teas and hot chocolates.",
    "basePrice": 310,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MUGS-1",
      "CMA-PROD-MUGS-2",
      "CMA-PROD-MUGS-3"
    ],
    "attributes": {
      "packSize": "4 Pack"
    }
  },
  {
    "key": "PROD-WOVEN-STORAGE-BASKET",
    "title": "Natural Ilala Palm Storage Basket with Lid",
    "categoryRef": "CC-DECOR",
    "ptCode": "HOME_LIVING",
    "brandName": "Mzansi Living Spaces",
    "shortDescription": "Handwoven indigenous palm laundry and organizing hamper.",
    "description": "Intricately coiled and woven by rural craft cooperatives using sustainable wild ilala palm fronds. Provides sturdy and decorative concealed storage for blankets, toys or laundry.",
    "basePrice": 420,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BASKET-1",
      "CMA-PROD-BASKET-2",
      "CMA-PROD-BASKET-3"
    ],
    "attributes": {
      "material": "Palm"
    }
  },
  {
    "key": "PROD-HARDCOVER-DOT-GRID-JOURNAL",
    "title": "A5 Hardcover Dot Grid Notebook 192 Pages",
    "categoryRef": "CC-BOOKS",
    "ptCode": "BOOKS_STATIONERY",
    "brandName": "Longmarket Paper and Print",
    "shortDescription": "Archival 120 gsm acid free paper with ribbon bookmark and elastic band.",
    "description": "Elegantly bound hardcover journal engineered for bullet journaling, sketching and fountain pens without ink bleed-through. Opens completely flat at 180 degrees with expandable back pocket.",
    "basePrice": 195,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-JOURNAL-1",
      "CMA-PROD-JOURNAL-2",
      "CMA-PROD-JOURNAL-3"
    ],
    "attributes": {
      "pages": 192
    }
  },
  {
    "key": "PROD-FOUNTAIN-PEN-BRASS",
    "title": "Solid Machined Brass Pocket Fountain Pen Fine Nib",
    "categoryRef": "CC-BOOKS",
    "ptCode": "BOOKS_STATIONERY",
    "brandName": "Longmarket Paper and Print",
    "shortDescription": "Heavyweight brass writing instrument with smooth iridium tip.",
    "description": "Machined from solid brass that oxidizes to an individual vintage luster. Perfectly balanced when cap is posted, using standard international ink cartridges or bottled ink converter.",
    "basePrice": 480,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PEN-1",
      "CMA-PROD-PEN-2",
      "CMA-PROD-PEN-3"
    ],
    "attributes": {
      "nib": "Fine"
    }
  },
  {
    "key": "PROD-CAR-WASH-SHAMPOO-2L",
    "title": "Foaming pH Balanced Car Wash Shampoo 2 L",
    "categoryRef": "CC-AUTOMOTIVE",
    "ptCode": "AUTOMOTIVE",
    "brandName": "MotorWorks Essentials",
    "shortDescription": "High-lubricity car cleaning concentrate with carnauba wax gloss.",
    "description": "Thick suds lift dirt, road grime and bug splatter safely away from vehicle paintwork without stripping protective sealant coats. Leaves a sparkling water-beading carnauba shine.",
    "basePrice": 140,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CAR-SHAMPOO-1",
      "CMA-PROD-CAR-SHAMPOO-2",
      "CMA-PROD-CAR-SHAMPOO-3"
    ],
    "attributes": {
      "volume": "2 L"
    }
  },
  {
    "key": "PROD-TYRE-INFLATOR-12V",
    "title": "Digital 12V Portable Auto Tyre Inflator Pump",
    "categoryRef": "CC-AUTOMOTIVE",
    "ptCode": "AUTOMOTIVE",
    "brandName": "Highveld Auto Spares",
    "shortDescription": "Compact vehicle compressor with automatic pressure shut-off.",
    "description": "Plugs directly into vehicle 12V cigarette lighter sockets to rapidly inflate car tyres, bicycles and sports balls. Features a bright backlit digital PSI display and integrated LED work light.",
    "basePrice": 420,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-INFLATOR-1",
      "CMA-PROD-INFLATOR-2",
      "CMA-PROD-INFLATOR-3"
    ],
    "attributes": {
      "power": "12 V"
    }
  },
  {
    "key": "PROD-CHOCOLATE-TRUFFLE-CAKE-20CM",
    "title": "Decadent Dark Chocolate Truffle Layer Cake 20 cm",
    "categoryRef": "CC-CAKES",
    "ptCode": "CAKES_BAKERY",
    "brandName": "Velvet Crumb Cake Studio",
    "shortDescription": "Triple-layer rich chocolate sponge layered with Belgian chocolate ganache.",
    "description": "Moist chocolate sponge filled and draped in 70 percent Belgian dark chocolate ganache, crowned with hand-rolled chocolate truffles and cocoa nibs. Serves 10 to 12 generous slices.",
    "basePrice": 380,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-CHOCOLATE-CAKE-1",
      "CMA-PROD-CHOCOLATE-CAKE-2",
      "CMA-PROD-CHOCOLATE-CAKE-3"
    ],
    "attributes": {
      "diameter": "20 cm"
    }
  },
  {
    "key": "PROD-LEMON-MERINGUE-TART-6PK",
    "title": "Individual Lemon Meringue Butter Tarts 6 Pack",
    "categoryRef": "CC-CAKES",
    "ptCode": "CAKES_BAKERY",
    "brandName": "Sweet Meadow Patisserie",
    "shortDescription": "Crisp shortcrust pastry shells with zesty lemon curd and toasted meringue.",
    "description": "Handcrafted individual tartlets filled with tart freshly squeezed lemon curd, topped with swirls of glossy Italian meringue and torched to golden perfection for afternoon tea.",
    "basePrice": 190,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-MERINGUE-1",
      "CMA-PROD-MERINGUE-2",
      "CMA-PROD-MERINGUE-3"
    ],
    "attributes": {
      "packSize": "6 Pack"
    }
  },
  {
    "key": "PROD-FYNBOS-BOUQUET-MEDIUM",
    "title": "Seasonal Indigenous Cape Fynbos Bouquet",
    "categoryRef": "CC-FLOWERS",
    "ptCode": "FLOWERS_PLANTS",
    "brandName": "Willow and Stem Florist",
    "shortDescription": "Hand-tied floral arrangement featuring king proteas, pincushions and fynbos.",
    "description": "Artisan hand-tied bouquet highlighting iconic South African botanical heritage. Features pink king proteas, vibrant yellow pincushions, wax flowers and fragrant silver tree foliage.",
    "basePrice": 320,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-BOUQUET-1",
      "CMA-PROD-BOUQUET-2",
      "CMA-PROD-BOUQUET-3"
    ],
    "attributes": {
      "indigenous": true
    }
  },
  {
    "key": "PROD-POTTED-MONSTERA-PLANT",
    "title": "Lush Potted Monstera Deliciosa in Ceramic Planter",
    "categoryRef": "CC-FLOWERS",
    "ptCode": "FLOWERS_PLANTS",
    "brandName": "Jacaranda Floral Design",
    "shortDescription": "Established Swiss cheese houseplant in modern 18 cm matte pot.",
    "description": "Thriving tropical foliage plant with distinct fenestrated glossy green leaves. Shipped rooted in well-draining soil inside an 18cm white matte ceramic planter. Easy indoor care.",
    "basePrice": 280,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MONSTERA-1",
      "CMA-PROD-MONSTERA-2",
      "CMA-PROD-MONSTERA-3"
    ],
    "attributes": {
      "potSize": "18 cm"
    }
  },
  {
    "key": "PROD-ADULT-DOG-FOOD-8KG",
    "title": "Grain Free Free Range Beef Adult Dog Food 8 kg",
    "categoryRef": "CC-PETS",
    "ptCode": "PET_CARE",
    "brandName": "Paw and Pantry Pet Supplies",
    "shortDescription": "High-protein natural dry dog kibble with prebiotics and omega oils.",
    "description": "Formulated for optimal canine digestive health and shiny coat vitality. Prepared with real free-range beef, sweet potatoes, peas and flaxseed oil without artificial colorants or grain fillers.",
    "basePrice": 485,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-DOG-FOOD-1",
      "CMA-PROD-DOG-FOOD-2",
      "CMA-PROD-DOG-FOOD-3"
    ],
    "attributes": {
      "weight": "8 kg"
    }
  },
  {
    "key": "PROD-SALMON-CAT-BISCUITS-2KG",
    "title": "Atlantic Salmon and Rice Complete Adult Cat Kibble 2 kg",
    "categoryRef": "CC-PETS",
    "ptCode": "PET_CARE",
    "brandName": "Cape Pet Nutrition",
    "shortDescription": "Nutrient-rich balanced cat food for digestive and urinary tract health.",
    "description": "Rich in real Atlantic salmon protein, taurine for clear vision and cranberry extract for urinary support. Crunchy bite-sized biscuits help control dental tartar buildup.",
    "basePrice": 220,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CAT-FOOD-1",
      "CMA-PROD-CAT-FOOD-2",
      "CMA-PROD-CAT-FOOD-3"
    ],
    "attributes": {
      "weight": "2 kg"
    }
  },
  {
    "key": "PROD-BUTTERNUT-2KG",
    "title": "Fresh Sweet Butternut Squash 2 kg",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Limpopo Sun Valley",
    "shortDescription": "Naturally sweet golden butternut squash with dense smooth flesh.",
    "description": "Locally harvested butternut squash ideal for roasting whole with brown butter, blending into velvety autumn soups or puréeing for wholesome baby meals.",
    "basePrice": 28,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BUTTERNUT-1",
      "CMA-PROD-BUTTERNUT-2",
      "CMA-PROD-BUTTERNUT-3"
    ],
    "attributes": {
      "weight": "2 kg"
    }
  },
  {
    "key": "PROD-MUSHROOMS-BROWN-250G",
    "title": "Whole Brown Portabellini Mushrooms 250 g",
    "categoryRef": "CC-FRESH-PRODUCE",
    "ptCode": "GROCERIES",
    "brandName": "Highveld Hydro Greens",
    "shortDescription": "Earthy firm portabellini mushrooms freshly packed in breathable punnet.",
    "description": "Rich umami-packed whole brown mushrooms perfect for creamy garlic sauces, braai skewers, risotto dishes and morning breakfast skillets.",
    "basePrice": 27.5,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MUSHROOMS-1",
      "CMA-PROD-MUSHROOMS-2",
      "CMA-PROD-MUSHROOMS-3"
    ],
    "attributes": {
      "weight": "250 g"
    }
  },
  {
    "key": "PROD-GOUDA-CHEESE-400G",
    "title": "Traditional Mild Farmhouse Gouda Cheese 400 g",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Karoo Creamery",
    "shortDescription": "Creamy golden Dutch style Gouda with smooth buttery texture.",
    "description": "Natural cow milk cheese aged for 3 months to develop a sweet mellow flavor. Melts evenly over toasted breads, homemade pizzas and macaroni cheese bakes.",
    "basePrice": 72,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-GOUDA-1",
      "CMA-PROD-GOUDA-2",
      "CMA-PROD-GOUDA-3"
    ],
    "attributes": {
      "weight": "400 g"
    }
  },
  {
    "key": "PROD-ALMOND-MILK-1L",
    "title": "Unsweetened Plant Based Almond Milk 1 L",
    "categoryRef": "CC-DAIRY-EGGS",
    "ptCode": "GROCERIES",
    "brandName": "Sun Valley Botanicals",
    "shortDescription": "Smooth creamy dairy-free almond milk fortified with calcium and vitamins.",
    "description": "Blended from lightly roasted almonds and pure mountain water. Completely lactose-free with zero added sugar. Excellent for lattes, matcha and morning granola bowls.",
    "basePrice": 39,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ALMOND-MILK-1",
      "CMA-PROD-ALMOND-MILK-2",
      "CMA-PROD-ALMOND-MILK-3"
    ],
    "attributes": {
      "volume": "1 L"
    }
  },
  {
    "key": "PROD-CANOLA-OIL-2L",
    "title": "Pure GMO Free Cold Filtered Canola Cooking Oil 2 L",
    "categoryRef": "CC-PANTRY",
    "ptCode": "GROCERIES",
    "brandName": "Harvest Crown",
    "shortDescription": "Neutral high smoke point cooking oil rich in plant omega 3.",
    "description": "Locally pressed non-GMO canola oil ideal for everyday frying, baking and salad dressings. Light clean taste with heart-healthy monounsaturated fatty acids.",
    "basePrice": 62,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CANOLA-OIL-1",
      "CMA-PROD-CANOLA-OIL-2",
      "CMA-PROD-CANOLA-OIL-3"
    ],
    "attributes": {
      "volume": "2 L"
    }
  },
  {
    "key": "PROD-PEANUT-BUTTER-400G",
    "title": "All Natural 100 Percent Crunchy Peanut Butter 400 g",
    "categoryRef": "CC-PANTRY",
    "ptCode": "GROCERIES",
    "brandName": "Ubuntu Valley Greens",
    "shortDescription": "Pure dry roasted peanuts stone ground with sea salt and no palm oil.",
    "description": "Wholesome crunchy peanut butter made purely with dry roasted groundnuts and a pinch of salt. Never contains hydrogenated fats, emulsifiers or added sugars.",
    "basePrice": 45,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PEANUT-BUTTER-1",
      "CMA-PROD-PEANUT-BUTTER-2",
      "CMA-PROD-PEANUT-BUTTER-3"
    ],
    "attributes": {
      "weight": "400 g"
    }
  },
  {
    "key": "PROD-DRIED-MANGO-200G",
    "title": "Sun Dried Soft Chewy Mango Strips 200 g",
    "categoryRef": "CC-SNACKS",
    "ptCode": "GROCERIES",
    "brandName": "Limpopo Sun Valley",
    "shortDescription": "Naturally sweet preservative free dried mango slices from Hoedspruit.",
    "description": "Tree-ripened Tommy Atkins mangoes gently dried to lock in tropical sweetness, vibrant color and vitamin A. Wholesome lunchbox and trail energy snack.",
    "basePrice": 58,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-DRIED-MANGO-1",
      "CMA-PROD-DRIED-MANGO-2",
      "CMA-PROD-DRIED-MANGO-3"
    ],
    "attributes": {
      "weight": "200 g"
    }
  },
  {
    "key": "PROD-ROOIBOS-CHAI-20S",
    "title": "Spiced Rooibos Chai Pyramid Infusions 20 Bags",
    "categoryRef": "CC-BEVERAGES",
    "ptCode": "GROCERIES",
    "brandName": "Sunbird Botanical",
    "shortDescription": "Indigenous rooibos blended with cardamon, cinnamon and fresh ginger.",
    "description": "Aromatic caffeine-free warming tea blend crafted with pure whole spices and organic red rooibos. Enjoy black with honey or brewed with warm milk as a comforting chai latte.",
    "basePrice": 48,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ROOIBOS-CHAI-1",
      "CMA-PROD-ROOIBOS-CHAI-2",
      "CMA-PROD-ROOIBOS-CHAI-3"
    ],
    "attributes": {
      "count": "20 Bags"
    }
  },
  {
    "key": "PROD-BBQ-BEEF-RIBS-MEAL",
    "title": "Slow Smoked BBQ Beef Short Ribs with Corn on Cob",
    "categoryRef": "CC-GRILL",
    "ptCode": "FOOD_DINING",
    "brandName": "Red Ember Kitchen",
    "shortDescription": "Tender fall-off-the-bone smoked beef ribs basted in sticky BBQ glaze.",
    "description": "Hickory-smoked for 6 hours until meltingly tender. Served with sweet buttered sweetcorn cobettes and crunchy purple cabbage slaw.",
    "basePrice": 185,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-BEEF-RIBS-1",
      "CMA-PROD-BEEF-RIBS-2",
      "CMA-PROD-BEEF-RIBS-3"
    ],
    "attributes": {
      "smokedHours": 6
    }
  },
  {
    "key": "PROD-FOUR-CHEESE-PIZZA",
    "title": "Quattro Formaggi Woodfired Artisan Pizza 30 cm",
    "categoryRef": "CC-PIZZA",
    "ptCode": "FOOD_DINING",
    "brandName": "Bree Street Artisans",
    "shortDescription": "White stonebaked pizza with mozzarella, gorgonzola, parmesan and fontina.",
    "description": "Crisp crust brushed with garlic olive oil and topped with four melting artisan cheeses, fresh thyme leaves and cracked black pepper.",
    "basePrice": 145,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-FOUR-CHEESE-PIZZA-1",
      "CMA-PROD-FOUR-CHEESE-PIZZA-2",
      "CMA-PROD-FOUR-CHEESE-PIZZA-3"
    ],
    "attributes": {
      "size": "30 cm"
    }
  },
  {
    "key": "PROD-VEGGIE-BURGER-DELUXE",
    "title": "Crispy Black Bean and Quinoa Plant Burger",
    "categoryRef": "CC-BURGERS",
    "ptCode": "FOOD_DINING",
    "brandName": "Red Ember Kitchen",
    "shortDescription": "Handcrafted savory bean and roasted sweet potato patty on toasted bun.",
    "description": "Packed with wholesome black beans, organic quinoa, roasted corn and smoked paprika. Topped with fresh avocado slices and vegan chipotle aioli.",
    "basePrice": 112,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-VEGGIE-BURGER-1",
      "CMA-PROD-VEGGIE-BURGER-2",
      "CMA-PROD-VEGGIE-BURGER-3"
    ],
    "attributes": {
      "plantBased": true
    }
  },
  {
    "key": "PROD-CHICKEN-TIKKA-MASALA",
    "title": "Flame Seared Chicken Tikka Masala with Jeera Rice",
    "categoryRef": "CC-TRADITIONAL",
    "ptCode": "FOOD_DINING",
    "brandName": "Durban Spice Table",
    "shortDescription": "Charred tandoori chicken chunks in rich aromatic fenugreek sauce.",
    "description": "Marinated in yoghurt and roasted spices, then simmered in a spiced tomato onion gravy with fresh green chilies and cream. Served with fragrant cumin rice.",
    "basePrice": 138,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-CHICKEN-TIKKA-1",
      "CMA-PROD-CHICKEN-TIKKA-2",
      "CMA-PROD-CHICKEN-TIKKA-3"
    ],
    "attributes": {
      "includes": "Jeera Rice"
    }
  },
  {
    "key": "PROD-CALAMARI-FRITTERS",
    "title": "Crispy Spiced Salt and Pepper Calamari Strips",
    "categoryRef": "CC-FOOD-DINING",
    "ptCode": "FOOD_DINING",
    "brandName": "Braam Grill House",
    "shortDescription": "Flash fried tender ocean calamari with lemon garlic tartare dip.",
    "description": "Tender squid tubes dusted in seasoned flour, flash-fried until crisp and served with fresh lemon wedges, herb salt and homemade creamy tartare dip.",
    "basePrice": 98,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-CALAMARI-1",
      "CMA-PROD-CALAMARI-2",
      "CMA-PROD-CALAMARI-3"
    ],
    "attributes": {
      "seafood": true
    }
  },
  {
    "key": "PROD-PULLED-BEEF-SANDWICH",
    "title": "Slow Roasted Pulled Beef Brisket Ciabatta",
    "categoryRef": "CC-FOOD-DINING",
    "ptCode": "FOOD_DINING",
    "brandName": "Ubuntu Fresh Market Kitchen",
    "shortDescription": "Tender shredded beef brisket with melted provolone and onion relish.",
    "description": "12-hour braised beef brisket piled high on a toasted artisan ciabatta with melted provolone cheese, rocket and tangy caramelized onion jam.",
    "basePrice": 115,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-PULLED-BEEF-1",
      "CMA-PROD-PULLED-BEEF-2",
      "CMA-PROD-PULLED-BEEF-3"
    ],
    "attributes": {
      "slowCooked": true
    }
  },
  {
    "key": "PROD-ALMOND-CROISSANT-2PK",
    "title": "Double Baked French Butter Almond Croissants 2 Pack",
    "categoryRef": "CC-FOOD-DINING",
    "ptCode": "FOOD_DINING",
    "brandName": "Kloof Street Bakehouse",
    "shortDescription": "Flaky butter croissants filled with creamy almond frangipane paste.",
    "description": "Handcrafted laminate pastry double-baked with velvety vanilla almond cream, topped with toasted sliced almonds and dusted with fine icing sugar.",
    "basePrice": 76,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-ALMOND-CROISSANT-1",
      "CMA-PROD-ALMOND-CROISSANT-2",
      "CMA-PROD-ALMOND-CROISSANT-3"
    ],
    "attributes": {
      "packSize": "2 Pack"
    }
  },
  {
    "key": "PROD-PORTUGUESE-CUSTARD-TARTS-4PK",
    "title": "Authentic Pasteis de Nata Custard Tarts 4 Pack",
    "categoryRef": "CC-FOOD-DINING",
    "ptCode": "FOOD_DINING",
    "brandName": "Sweet Meadow Patisserie",
    "shortDescription": "Crisp blistered puff pastry cups filled with caramelized egg custard.",
    "description": "Traditional Portuguese custard tarts with flaky crackling pastry and creamy vanilla cinnamon custard baked at high temperature for caramelized tops.",
    "basePrice": 82,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "MADE_TO_ORDER",
    "imageKeys": [
      "CMA-PROD-NATA-TARTS-1",
      "CMA-PROD-NATA-TARTS-2",
      "CMA-PROD-NATA-TARTS-3"
    ],
    "attributes": {
      "packSize": "4 Pack"
    }
  },
  {
    "key": "PROD-IBUPROFEN-400MG-20TAB",
    "title": "Ibuprofen 400 mg Anti Inflammatory 20 Tablets",
    "categoryRef": "CC-OTC-RELIEF",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "CarePlus Healthcare",
    "shortDescription": "Non-steroidal anti-inflammatory pain relief for muscular sprains.",
    "description": "Provides targeted relief from joint stiffness, back pain, dental inflammation and muscular swelling. Read package insert for dosage guidance.",
    "basePrice": 36,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-IBUPROFEN-1",
      "CMA-PROD-IBUPROFEN-2",
      "CMA-PROD-IBUPROFEN-3"
    ],
    "attributes": {
      "tabletCount": 20
    }
  },
  {
    "key": "PROD-MAGNESIUM-CHELATE-60CAP",
    "title": "High Absorption Magnesium Glycinate 60 Capsules",
    "categoryRef": "CC-VITAMINS",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Vital Boost Pharma",
    "shortDescription": "Gentle chelated magnesium for muscular recovery and deep sleep.",
    "description": "Highly bioavailable magnesium glycinate formulated to ease muscular tension, nocturnal cramps and support relaxed nervous system recovery.",
    "basePrice": 185,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MAGNESIUM-1",
      "CMA-PROD-MAGNESIUM-2",
      "CMA-PROD-MAGNESIUM-3"
    ],
    "attributes": {
      "count": 60
    }
  },
  {
    "key": "PROD-TEA-TREE-OIL-20ML",
    "title": "Pure Organic Tea Tree Essential Oil 20 ml",
    "categoryRef": "CC-PERSONAL-CARE",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Highveld Botanical",
    "shortDescription": "Antimicrobial essential oil for skin blemishes and scalp care.",
    "description": "Steam distilled from indigenous Melaleuca alternifolia leaves. Renowned for natural cleansing, skin blemish soothing and nail hygiene.",
    "basePrice": 68,
    "condition": "NEW",
    "sellingUnit": "VOLUME",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-TEA-TREE-OIL-1",
      "CMA-PROD-TEA-TREE-OIL-2",
      "CMA-PROD-TEA-TREE-OIL-3"
    ],
    "attributes": {
      "volume": "20 ml"
    }
  },
  {
    "key": "PROD-ZINC-COMPLEX-60TAB",
    "title": "Immune Support Zinc and Vitamin D3 60 Tablets",
    "categoryRef": "CC-VITAMINS",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Vital Boost Pharma",
    "shortDescription": "Synergistic combination of elemental zinc and active vitamin D3.",
    "description": "Helps maintain strong immune defence mechanisms, cellular energy and bone density throughout winter and busy working schedules.",
    "basePrice": 110,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ZINC-D3-1",
      "CMA-PROD-ZINC-D3-2",
      "CMA-PROD-ZINC-D3-3"
    ],
    "attributes": {
      "count": 60
    }
  },
  {
    "key": "PROD-EUCALYPTUS-RUB-100G",
    "title": "Soothing Herbal Eucalyptus Chest Vapor Rub 100 g",
    "categoryRef": "CC-OTC-RELIEF",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Highveld Botanical",
    "shortDescription": "Aromatic chest ointment with menthol, camphor and blue gum oil.",
    "description": "Provides cooling comforting vapors that ease breathing during seasonal colds, coughs and chest congestion. Gentle on family skin.",
    "basePrice": 44,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-EUCALYPTUS-RUB-1",
      "CMA-PROD-EUCALYPTUS-RUB-2",
      "CMA-PROD-EUCALYPTUS-RUB-3"
    ],
    "attributes": {
      "weight": "100 g"
    }
  },
  {
    "key": "PROD-HYDROCOLLOID-PLASTERS-10PK",
    "title": "Waterproof Hydrocolloid Blister Plasters 10 Pack",
    "categoryRef": "CC-FIRST-AID",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "SafeGuard Medical",
    "shortDescription": "Second-skin gel plasters that cushion and accelerate blister healing.",
    "description": "Flexible waterproof hydrocolloid dressings that absorb wound fluid while forming a protective barrier against footwear friction and water.",
    "basePrice": 54,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-HYDROCOLLOID-1",
      "CMA-PROD-HYDROCOLLOID-2",
      "CMA-PROD-HYDROCOLLOID-3"
    ],
    "attributes": {
      "count": 10
    }
  },
  {
    "key": "PROD-ROOIBOS-SKIN-BALM-50G",
    "title": "Organic Rooibos and Calendula Rescue Balm 50 g",
    "categoryRef": "CC-PERSONAL-CARE",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Highveld Botanical",
    "shortDescription": "Concentrated waterless balm for rough elbows, cuticles and dry patches.",
    "description": "Enriched with antioxidant-rich green rooibos extract, soothing calendula petals and cold-pressed sunflower oil for intense localized barrier repair.",
    "basePrice": 78,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-RESCUE-BALM-1",
      "CMA-PROD-RESCUE-BALM-2",
      "CMA-PROD-RESCUE-BALM-3"
    ],
    "attributes": {
      "weight": "50 g"
    }
  },
  {
    "key": "PROD-DIGESTIVE-ENZYMES-60CAP",
    "title": "Broad Spectrum Plant Digestive Enzymes 60 Capsules",
    "categoryRef": "CC-VITAMINS",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Vital Boost Pharma",
    "shortDescription": "Comprehensive enzyme blend to support healthy comfortable digestion.",
    "description": "Formulated with bromelain, papain, amylase and lactase to assist breakdown of proteins, carbohydrates, fats and dairy sugars.",
    "basePrice": 165,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ENZYMES-1",
      "CMA-PROD-ENZYMES-2",
      "CMA-PROD-ENZYMES-3"
    ],
    "attributes": {
      "count": 60
    }
  },
  {
    "key": "PROD-KOEKSISTERS-12PK",
    "title": "Traditional Golden Syrup Koeksisters 12 Pack",
    "categoryRef": "CC-CAKES",
    "ptCode": "CAKES_BAKERY",
    "brandName": "Ouma Hettie Bakery",
    "shortDescription": "Crispy braided golden pastries infused with sweet spiced cinnamon and ginger syrup.",
    "description": "Authentic handmade South African koeksisters, braided to perfection, deep-fried to golden amber, and submerged ice-cold into rich spiced sugar syrup with hints of ginger and lemon.",
    "basePrice": 65,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-KOEKSISTERS-1",
      "CMA-PROD-KOEKSISTERS-2",
      "CMA-PROD-KOEKSISTERS-3"
    ],
    "attributes": {
      "packSize": "12 Pack",
      "allergens": "Gluten"
    }
  },
  {
    "key": "PROD-MELKTERT-TRADITIONAL",
    "title": "Classic Cape Dutch Milk Tart 22cm",
    "categoryRef": "CC-CAKES",
    "ptCode": "CAKES_BAKERY",
    "brandName": "Kloof Street Bakery",
    "shortDescription": "Velvety sweet milk custard tart in flaky sweetcrust pastry dusted with Ceylon cinnamon.",
    "description": "Heritage Cape Dutch melktert prepared with rich whole milk, farm butter, and egg yolks, baked in a crisp sweet pastry shell and generously dusted with fragrant freshly ground cinnamon.",
    "basePrice": 85,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MELKTERT-1",
      "CMA-PROD-MELKTERT-2",
      "CMA-PROD-MELKTERT-3"
    ],
    "attributes": {
      "size": "22cm",
      "servings": "8 Servings"
    }
  },
  {
    "key": "PROD-PEPPERMINT-CRISP-TART",
    "title": "Decadent Peppermint Crisp Tart Slices 4 Pack",
    "categoryRef": "CC-CAKES",
    "ptCode": "CAKES_BAKERY",
    "brandName": "Sweet Meadow Patisserie",
    "shortDescription": "Layered Tennis biscuit, whipped caramel cream, and mint chocolate confection slices.",
    "description": "South Africa's beloved celebration dessert crafted in individual dessert portions. Alternating layers of coconut Tennis biscuits, cooked caramel treat, whipped cream, and shaved peppermint mint cracknel chocolate.",
    "basePrice": 95,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PEPCRISP-1",
      "CMA-PROD-PEPCRISP-2",
      "CMA-PROD-PEPCRISP-3"
    ],
    "attributes": {
      "packSize": "4 Pack",
      "refrigeration": "Keep Chilled"
    }
  },
  {
    "key": "PROD-CARROT-CAKE-SPICED",
    "title": "Karoo Spiced Carrot Cake with Cream Cheese 20cm",
    "categoryRef": "CC-CAKES",
    "ptCode": "CAKES_BAKERY",
    "brandName": "Velvet Crumb Cake Studio",
    "shortDescription": "Moist spiced two-layer carrot sponge topped with rich zesty cream cheese frosting and walnuts.",
    "description": "Wholesome sponge cake folded with grated organic carrots, crushed pineapple, golden sultanas, and chopped pecans, layered and crowned with velvety citrus-infused cream cheese frosting.",
    "basePrice": 195,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CARROTCAKE-1",
      "CMA-PROD-CARROTCAKE-2",
      "CMA-PROD-CARROTCAKE-3"
    ],
    "attributes": {
      "size": "20cm",
      "shelfLife": "4 Days"
    }
  },
  {
    "key": "PROD-FUDGE-BROWNIES-6PK",
    "title": "Double Chocolate Salted Caramel Brownies 6 Pack",
    "categoryRef": "CC-CAKES",
    "ptCode": "CAKES_BAKERY",
    "brandName": "Velvet Crumb Cake Studio",
    "shortDescription": "Dense chewy dark chocolate brownie squares rippled with rich Kalahari sea salt caramel.",
    "description": "Baked with 70% dark Belgian cocoa and browned farmhouse butter. Each square has a delicate crinkly top crust, fudgy molten center, and a swirl of house-made sea salted caramel.",
    "basePrice": 78,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BROWNIES-1",
      "CMA-PROD-BROWNIES-2",
      "CMA-PROD-BROWNIES-3"
    ],
    "attributes": {
      "packSize": "6 Pack",
      "cocoaPercentage": 70
    }
  },
  {
    "key": "PROD-SOURDOUGH-RYE-LOAF",
    "title": "Dark Sourdough Rye Seeded Country Loaf 800g",
    "categoryRef": "CC-CAKES",
    "ptCode": "CAKES_BAKERY",
    "brandName": "Kloof Street Bakery",
    "shortDescription": "Dense nutritious stoneground sourdough rye loaf crusted with toasted sunflower and flax seeds.",
    "description": "Naturally leavened over 36 hours using whole stoneground rye flour from Swartland mills. Deep complex earthy flavor, moist crumb, and a thick crunch crust rolled in sesame, flax, and sunflower seeds.",
    "basePrice": 52,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-RYELOAF-1",
      "CMA-PROD-RYELOAF-2",
      "CMA-PROD-RYELOAF-3"
    ],
    "attributes": {
      "weight": "800g",
      "flourType": "Stoneground Rye"
    }
  },
  {
    "key": "PROD-BUTTERMILK-SCONES-6PK",
    "title": "Freshly Baked Country Buttermilk Scones 6 Pack",
    "categoryRef": "CC-CAKES",
    "ptCode": "CAKES_BAKERY",
    "brandName": "Ouma Hettie Bakery",
    "shortDescription": "Fluffy tall golden buttermilk scones perfect for afternoon high tea with clotted cream.",
    "description": "Hand-rolled golden tea scones prepared with creamy pasture buttermilk and chilled butter. Light and tender inside with a delicate golden crumb. Best served warm with strawberry jam and farm butter.",
    "basePrice": 46,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SCONES-1",
      "CMA-PROD-SCONES-2",
      "CMA-PROD-SCONES-3"
    ],
    "attributes": {
      "packSize": "6 Pack",
      "servingStyle": "Warm"
    }
  },
  {
    "key": "PROD-RED-VELVET-CUPCAKES",
    "title": "Velvet Crumb Red Velvet Cupcakes with Cream Cheese 6pk",
    "categoryRef": "CC-CAKES",
    "ptCode": "CAKES_BAKERY",
    "brandName": "Velvet Crumb Cake Studio",
    "shortDescription": "Silky crimson cocoa cupcakes crowned with piped Madagascar vanilla cream cheese swirl.",
    "description": "Classic Southern-style red velvet cupcakes with a soft, moist cocoa sponge, piped high with tangy vanilla bean cream cheese frosting and garnished with fine red velvet cake crumbs.",
    "basePrice": 110,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CUPCAKES-1",
      "CMA-PROD-CUPCAKES-2",
      "CMA-PROD-CUPCAKES-3"
    ],
    "attributes": {
      "packSize": "6 Pack",
      "presentation": "Bakery Gift Box"
    }
  },
  {
    "key": "PROD-SA-BIRDS-GUIDE",
    "title": "Sasol Birds of Southern Africa Illustrated Guide",
    "categoryRef": "CC-BOOKS",
    "ptCode": "BOOKS_STATIONERY",
    "brandName": "Struik Nature Heritage",
    "shortDescription": "The authoritative comprehensive field guide to Southern Africa's rich avifauna.",
    "description": "Fifth edition of the premier bird identification handbook covering over 950 avian species. Features full-color diagnostic artwork, updated regional distribution maps, and call sonograms.",
    "basePrice": 340,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BIRDBOOK-1",
      "CMA-PROD-BIRDBOOK-2",
      "CMA-PROD-BIRDBOOK-3"
    ],
    "attributes": {
      "pages": 528,
      "format": "Paperback with Plastic Jacket"
    }
  },
  {
    "key": "PROD-KAROO-HERITAGE-COOKBOOK",
    "title": "Flavors of the Great Karoo Traditional Recipe Collection",
    "categoryRef": "CC-BOOKS",
    "ptCode": "BOOKS_STATIONERY",
    "brandName": "Table Mountain Publishing",
    "shortDescription": "Warm culinary journeys and authentic recipes from historic Karoo farmhouse kitchens.",
    "description": "Richly photographed hardcover volume documenting authentic Karoo heritage cooking: slow-roasted lamb shank bredies, potbrood on open coals, dried fruit chutneys, and spiced milk puddings.",
    "basePrice": 285,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-KAROOCOOK-1",
      "CMA-PROD-KAROOCOOK-2",
      "CMA-PROD-KAROOCOOK-3"
    ],
    "attributes": {
      "binding": "Hardcover",
      "photography": "Full Color"
    }
  },
  {
    "key": "PROD-KRUGER-WILDLIFE-HANDBOOK",
    "title": "Kruger National Park Mammals and Tracks Field Handbook",
    "categoryRef": "CC-BOOKS",
    "ptCode": "BOOKS_STATIONERY",
    "brandName": "Struik Nature Heritage",
    "shortDescription": "Essential pocket guide to game viewing, predator behavior and animal track identification.",
    "description": "Water-resistant compact bushveld guide detailing mammal behavior, spoor patterns, watering hole habits, and best viewing circuits throughout the greater Kruger wilderness region.",
    "basePrice": 220,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-KRUGERBOOK-1",
      "CMA-PROD-KRUGERBOOK-2",
      "CMA-PROD-KRUGERBOOK-3"
    ],
    "attributes": {
      "cover": "Flexi-bound Bushproof",
      "illustrated": true
    }
  },
  {
    "key": "PROD-MANDELA-BIOGRAPHY",
    "title": "Long Walk to Freedom: Illustrated Heritage Edition",
    "categoryRef": "CC-BOOKS",
    "ptCode": "BOOKS_STATIONERY",
    "brandName": "Macmillan Heritage Press",
    "shortDescription": "Nelson Mandela's monumental autobiography with archival historical photographs.",
    "description": "Collector's illustrated edition of the global liberation classic. Chronicles Nelson Mandela's childhood in the Transkei, decades of resistance, Robben Island imprisonment, and democratic triumph.",
    "basePrice": 395,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MANDELABOOK-1",
      "CMA-PROD-MANDELABOOK-2",
      "CMA-PROD-MANDELABOOK-3"
    ],
    "attributes": {
      "edition": "Collector Hardcover",
      "ribbonMarker": true
    }
  },
  {
    "key": "PROD-FYNBOS-PLANTS-FIELDGUIDE",
    "title": "Field Guide to Wildflowers of the Western Cape",
    "categoryRef": "CC-BOOKS",
    "ptCode": "BOOKS_STATIONERY",
    "brandName": "Struik Nature Heritage",
    "shortDescription": "Botanical guide to proteas, ericas, restios and endemic flora of the Cape floral biome.",
    "description": "Authoritative identification field manual covering 1,200 species of the Cape Floral Kingdom. Detailed botanical descriptions, flowering times, and geographic distribution zones.",
    "basePrice": 310,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-FYNBOSBOOK-1",
      "CMA-PROD-FYNBOSBOOK-2",
      "CMA-PROD-FYNBOSBOOK-3"
    ],
    "attributes": {
      "pages": 480,
      "category": "Natural Sciences"
    }
  },
  {
    "key": "PROD-LEATHER-BOUND-NOTEBOOK",
    "title": "Handcrafted Full-Grain Leather Journal A5",
    "categoryRef": "CC-BOOKS",
    "ptCode": "BOOKS_STATIONERY",
    "brandName": "Veld Leatherworks",
    "shortDescription": "Heirloom refillable leather notebook cover with acid-free unlined cotton parchment.",
    "description": "Hand-stitched in the Karoo from 2.2mm pull-up cowhide that develops a unique vintage patina with age. Includes 192 pages of 120gsm fountain-pen friendly archival cream paper.",
    "basePrice": 260,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-LEATHERNOTE-1",
      "CMA-PROD-LEATHERNOTE-2",
      "CMA-PROD-LEATHERNOTE-3"
    ],
    "attributes": {
      "size": "A5",
      "paperWeight": "120gsm",
      "refillable": true
    }
  },
  {
    "key": "PROD-FOUNTAIN-PEN-INK-SET",
    "title": "Cape Town Blue Fountain Pen Calligraphy Ink 50ml",
    "categoryRef": "CC-BOOKS",
    "ptCode": "BOOKS_STATIONERY",
    "brandName": "Longmarket Paper and Print",
    "shortDescription": "Rich deep indigo writing ink in heavy glass decanter with brass wax seal cap.",
    "description": "Formulated for smooth flowing nib performance and rich shading. Water-based dye ink reminiscent of the Atlantic twilight ocean, safely balanced for modern and vintage fountain pens.",
    "basePrice": 145,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PENINK-1",
      "CMA-PROD-PENINK-2",
      "CMA-PROD-PENINK-3"
    ],
    "attributes": {
      "volume": "50ml",
      "bottleMaterial": "Glass"
    }
  },
  {
    "key": "PROD-BOTANICAL-CARDS-SET",
    "title": "Protea and Fynbos Watercolor Greeting Cards 10 Pack",
    "categoryRef": "CC-BOOKS",
    "ptCode": "BOOKS_STATIONERY",
    "brandName": "Longmarket Paper and Print",
    "shortDescription": "Boxed set of blank greeting cards with hand-painted indigenous botanical illustrations.",
    "description": "Printed on heavy textured 300gsm FSC-certified cardstock with matching recycled brown kraft envelopes. Features King Protea, Silver Tree, Red Disa, and Pincushion watercolors.",
    "basePrice": 125,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CARDS-1",
      "CMA-PROD-CARDS-2",
      "CMA-PROD-CARDS-3"
    ],
    "attributes": {
      "quantity": "10 Cards + Envelopes",
      "paperType": "300gsm Textured"
    }
  },
  {
    "key": "PROD-RATCHET-STRAPS-4PK",
    "title": "Heavy Duty Cargo Ratchet Tie-Down Straps 4 Pack",
    "categoryRef": "CC-AUTOMOTIVE",
    "ptCode": "AUTOMOTIVE",
    "brandName": "Highveld Auto Gear",
    "shortDescription": "Commercial grade 5-metre webbing ratchet straps rated to 2,000kg load capacity.",
    "description": "Industrial strength polyester webbing straps with corrosion-resistant zinc-plated ratchet mechanisms and rubberized grip handles. Double J-hooks ensure secure anchoring on bakkies and trailers.",
    "basePrice": 245,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-STRAPS-1",
      "CMA-PROD-STRAPS-2",
      "CMA-PROD-STRAPS-3"
    ],
    "attributes": {
      "length": "5m",
      "breakStrength": "2000kg",
      "packSize": "4 Pack"
    }
  },
  {
    "key": "PROD-JUMP-CABLES-3M",
    "title": "Heavy Duty Booster Jump Starter Cables 3 Metre",
    "categoryRef": "CC-AUTOMOTIVE",
    "ptCode": "AUTOMOTIVE",
    "brandName": "Highveld Auto Gear",
    "shortDescription": "High-amperage 600A emergency battery cables with fully insulated copper clamps.",
    "description": "Flexible multi-strand copper-clad aluminium core cables engineered for reliable starting of petrol and diesel passenger vehicles, SUVs, and commercial bakkies. Includes durable zipped carry bag.",
    "basePrice": 295,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CABLES-1",
      "CMA-PROD-CABLES-2",
      "CMA-PROD-CABLES-3"
    ],
    "attributes": {
      "length": "3.5m",
      "rating": "600A",
      "copperGrip": true
    }
  },
  {
    "key": "PROD-SAFETY-BREAKDOWN-VEST",
    "title": "High-Visibility Reflective Emergency Roadside Vest",
    "categoryRef": "CC-AUTOMOTIVE",
    "ptCode": "AUTOMOTIVE",
    "brandName": "MotorWorks Essentials",
    "shortDescription": "SABS-compliant fluorescent yellow emergency safety vest with 360-degree reflective bands.",
    "description": "Mandatory South African highway safety gear. Lightweight breathable mesh fabric with velcro closure, ensuring daytime conspicuity and nighttime retroreflective safety during roadside stops.",
    "basePrice": 85,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-VEST-1",
      "CMA-PROD-VEST-2",
      "CMA-PROD-VEST-3"
    ],
    "attributes": {
      "standard": "SABS Compliant",
      "size": "Universal XL"
    }
  },
  {
    "key": "PROD-MICROFIBER-CLOTHS-6PK",
    "title": "Premium Scratch-Free Microfiber Detailing Towels 6pk",
    "categoryRef": "CC-AUTOMOTIVE",
    "ptCode": "AUTOMOTIVE",
    "brandName": "MotorWorks Essentials",
    "shortDescription": "Plush 450gsm dual-pile microfiber detailing cloths for buffing, drying and glass cleaning.",
    "description": "Ultra-soft edgeless towels that trap dirt and lift polishes without swirling delicate clear-coat paints. Lint-free and safe for vehicle touchscreens, paintwork, chrome, and leather interiors.",
    "basePrice": 120,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MICROCLOTHS-1",
      "CMA-PROD-MICROCLOTHS-2",
      "CMA-PROD-MICROCLOTHS-3"
    ],
    "attributes": {
      "density": "450gsm",
      "packSize": "6 Pack",
      "machineWashable": true
    }
  },
  {
    "key": "PROD-EMERGENCY-TYRE-SEAL",
    "title": "Quick Puncture Repair Emergency Tyre Inflator 500ml",
    "categoryRef": "CC-AUTOMOTIVE",
    "ptCode": "AUTOMOTIVE",
    "brandName": "MotorWorks Essentials",
    "shortDescription": "Instant tubeless tyre puncture sealant and re-inflator aerosol for roadside emergencies.",
    "description": "Seals tread punctures up to 5mm within seconds while inflating the tyre to safe emergency driving pressure. Screws directly onto standard tyre valves without wheel removal.",
    "basePrice": 135,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-TYRESEAL-1",
      "CMA-PROD-TYRESEAL-2",
      "CMA-PROD-TYRESEAL-3"
    ],
    "attributes": {
      "volume": "500ml",
      "maxPuncture": "5mm"
    }
  },
  {
    "key": "PROD-ALL-WEATHER-CAR-MATS",
    "title": "Heavy Duty Deep-Dish Rubber Car Floor Mats 4pc",
    "categoryRef": "CC-AUTOMOTIVE",
    "ptCode": "AUTOMOTIVE",
    "brandName": "Highveld Auto Gear",
    "shortDescription": "Universal trimmable heavy-gauge rubber floor mats with high spill containment rims.",
    "description": "Engineered to trap mud, red dust, sand, and liquids. Deep ribbed channel design with anti-slip backing spikes ensures zero mat movement while driving. Easy hose-down wash.",
    "basePrice": 420,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CARMATS-1-R2",
      "CMA-PROD-CARMATS-2-R2",
      "CMA-PROD-CARMATS-3-R2"
    ],
    "attributes": {
      "pieceCount": 4,
      "material": "Heavy Duty Natural Rubber"
    }
  },
  {
    "key": "PROD-KING-PROTEA-ARRANGEMENT",
    "title": "Fresh Cut Giant King Protea & Fynbos Stem Bunch",
    "categoryRef": "CC-FLOWERS",
    "ptCode": "FLOWERS_PLANTS",
    "brandName": "Willow & Stem Florist",
    "shortDescription": "Majestic national flower centerpiece surrounded by fresh silver tree and berzelia foliage.",
    "description": "Hand-harvested from high-altitude Helderberg floral reserves. Features a stunning focal King Protea Cynaroides complemented by silvery Leucadendron foliage and fragrant wild fynbos filler.",
    "basePrice": 265,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-KINGPROTEA-1",
      "CMA-PROD-KINGPROTEA-2",
      "CMA-PROD-KINGPROTEA-3"
    ],
    "attributes": {
      "vaseLife": "14 Days",
      "origin": "Western Cape"
    }
  },
  {
    "key": "PROD-CAPE-FYNBOS-MIX",
    "title": "Vibrant Table Mountain Mixed Fynbos Bouquet",
    "categoryRef": "CC-FLOWERS",
    "ptCode": "FLOWERS_PLANTS",
    "brandName": "Willow & Stem Florist",
    "shortDescription": "Color-rich artisanal bouquet of pincushions, heath ericas, and indigenous wax flowers.",
    "description": "Celebration of Cape biodiversity showcasing bright crimson and yellow Leucospermum, pink Erica bell-flowers, and fresh eucalyptus accents wrapped in eco-friendly kraft and twine.",
    "basePrice": 185,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-FYNBOSMIX-1",
      "CMA-PROD-FYNBOSMIX-2",
      "CMA-PROD-FYNBOSMIX-3"
    ],
    "attributes": {
      "style": "Wildflower Rustic",
      "waterCare": "Change Every 3 Days"
    }
  },
  {
    "key": "PROD-PINCUSHION-PROTEAS",
    "title": "Bright Orange Pincushion Protea Fresh Cut 5 Stem",
    "categoryRef": "CC-FLOWERS",
    "ptCode": "FLOWERS_PLANTS",
    "brandName": "Jacaranda Floral Design",
    "shortDescription": "Dramatic architectural sunburst orange blooms with outstanding vase longevity.",
    "description": "Five long-stemmed Leucospermum cordifolium blooms with radiant curved orange styles. A modern sculptural flower arrangement that naturally dries beautifully as an everlasting display.",
    "basePrice": 165,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PINCUSHION-1",
      "CMA-PROD-PINCUSHION-2",
      "CMA-PROD-PINCUSHION-3"
    ],
    "attributes": {
      "stemCount": 5,
      "dryingPotential": "Excellent"
    }
  },
  {
    "key": "PROD-STRELITZIA-POTTED",
    "title": "Bird of Paradise Strelitzia Reginae Potted Plant",
    "categoryRef": "CC-FLOWERS",
    "ptCode": "FLOWERS_PLANTS",
    "brandName": "Jacaranda Floral Design",
    "shortDescription": "Iconic indigenous evergreen plant with dramatic crane-shaped orange and blue flowers.",
    "description": "Lush architectural potted Strelitzia in a 25cm nursery planter. Thrives in bright sunlit indoor spaces and patio corners, producing exotic avian-shaped flowers through autumn and winter.",
    "basePrice": 240,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-STRELITZIA-1",
      "CMA-PROD-STRELITZIA-2",
      "CMA-PROD-STRELITZIA-3"
    ],
    "attributes": {
      "height": "65-75cm",
      "lightRequirement": "Bright Light"
    }
  },
  {
    "key": "PROD-SPEKBOOM-TERRACOTTA",
    "title": "Indigenous Spekboom Wonder Plant in Clay Pot",
    "categoryRef": "CC-FLOWERS",
    "ptCode": "FLOWERS_PLANTS",
    "brandName": "Jacaranda Floral Design",
    "shortDescription": "Ultra-resilient carbon-capturing miracle succulent potted in natural terracotta.",
    "description": "Portulacaria afra, celebrated as nature's champion carbon sponge. Highly drought-tolerant with glossy green jade-like leaves, planted in a porous 18cm earthenware pot with drainage saucer.",
    "basePrice": 130,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SPEKBOOM-1",
      "CMA-PROD-SPEKBOOM-2",
      "CMA-PROD-SPEKBOOM-3"
    ],
    "attributes": {
      "potDiameter": "18cm",
      "wateringInterval": "Every 2 Weeks"
    }
  },
  {
    "key": "PROD-WHITE-ORCHID-DUO",
    "title": "Double Stem White Phalaenopsis Orchid in Ceramic Pot",
    "categoryRef": "CC-FLOWERS",
    "ptCode": "FLOWERS_PLANTS",
    "brandName": "Willow & Stem Florist",
    "shortDescription": "Graceful cascading white moth orchid blooms potted in a matte white ceramic cylinder.",
    "description": "Two blooming spikes with up to 14 pristine snow-white flowers and lush glossy root systems bedded in pine bark orchid substrate. An elegant indoor living statement.",
    "basePrice": 320,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ORCHID-1",
      "CMA-PROD-ORCHID-2",
      "CMA-PROD-ORCHID-3"
    ],
    "attributes": {
      "bloomCount": "12-16 Flowers",
      "height": "60cm"
    }
  },
  {
    "key": "PROD-OSTRICH-BONE-CHEW",
    "title": "Natural Giant Ostrich Bone Dog Chew 2 Pack",
    "categoryRef": "CC-PETS",
    "ptCode": "PET_CARE",
    "brandName": "Cape Pet Nutrition",
    "shortDescription": "Hypoallergenic honeycombed bone chews naturally rich in calcium and marrow.",
    "description": "Slowly air-dried Oudtshoorn ostrich knuckle bones with zero chemical preservatives. Unique honeycomb bone structure crushes safely into digestible crumbs without splintering into sharp shards.",
    "basePrice": 125,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-OSTRICHBONE-1",
      "CMA-PROD-OSTRICHBONE-2",
      "CMA-PROD-OSTRICHBONE-3"
    ],
    "attributes": {
      "packSize": "2 Bones",
      "petSize": "Medium to Large Dogs"
    }
  },
  {
    "key": "PROD-VENISON-DOG-TREATS",
    "title": "Free-Range Karoo Venison Crunch Dog Biscuits 500g",
    "categoryRef": "CC-PETS",
    "ptCode": "PET_CARE",
    "brandName": "Paw & Pantry Pet Supplies",
    "shortDescription": "Oat and venison oven-baked crunchy biscuits for sensitive dogs and training rewards.",
    "description": "Single-protein hypoallergenic treats baked with wild springbok venison, stoneground rolled oats, and cold-pressed rooibos tea extracts for skin and joint anti-inflammatory benefits.",
    "basePrice": 85,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-VENISONDOG-1",
      "CMA-PROD-VENISONDOG-2",
      "CMA-PROD-VENISONDOG-3"
    ],
    "attributes": {
      "weight": "500g",
      "proteinSource": "Wild Venison"
    }
  },
  {
    "key": "PROD-SALMON-OIL-250ML",
    "title": "Pure Wild Cold-Pressed Salmon Oil Coat Supplement 250ml",
    "categoryRef": "CC-PETS",
    "ptCode": "PET_CARE",
    "brandName": "Cape Pet Nutrition",
    "shortDescription": "High-potency EPA and DHA Omega-3 liquid supplement for lustrous coats and joint agility.",
    "description": "Food-grade pure marine salmon oil in an amber pump dispenser. Easily drizzled over kibble to alleviate seasonal itching, support cardiac health, and lubricate aging canine and feline joints.",
    "basePrice": 180,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SALMONOIL-1",
      "CMA-PROD-SALMONOIL-2",
      "CMA-PROD-SALMONOIL-3"
    ],
    "attributes": {
      "volume": "250ml",
      "omega3Concentration": "High EPA/DHA"
    }
  },
  {
    "key": "PROD-ORGANIC-CATNIP-TOYS",
    "title": "Handmade Wool Mice with Organic Karoo Catnip 3pk",
    "categoryRef": "CC-PETS",
    "ptCode": "PET_CARE",
    "brandName": "Paw & Pantry Pet Supplies",
    "shortDescription": "Felted natural wool play mice stuffed with potent farm-grown organic catnip leaves.",
    "description": "Crafted from 100% natural Karoo sheep wool with leather string tails. Generously packed with sun-dried South African Nepeta cataria herbs that stimulate active feline play and exercise.",
    "basePrice": 75,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CATTOYS-1",
      "CMA-PROD-CATTOYS-2",
      "CMA-PROD-CATTOYS-3"
    ],
    "attributes": {
      "count": 3,
      "material": "Felted Wool"
    }
  },
  {
    "key": "PROD-MERINO-PET-BLANKET",
    "title": "Reversible Fleece and Merino Wool Calming Dog Blanket",
    "categoryRef": "CC-PETS",
    "ptCode": "PET_CARE",
    "brandName": "Paw & Pantry Pet Supplies",
    "shortDescription": "Ultra-cozy thermal dog blanket with soft brushed sherpa fleece and warm merino wool.",
    "description": "Machine-washable pet bed throw blanket measuring 100x120cm. Provides comforting weighted warmth on cold winter nights, protects vehicle upholstery during vet trips, and calms anxious pets.",
    "basePrice": 240,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PETBLANKET-1",
      "CMA-PROD-PETBLANKET-2",
      "CMA-PROD-PETBLANKET-3"
    ],
    "attributes": {
      "dimensions": "100x120cm",
      "washable": true
    }
  },
  {
    "key": "PROD-REFLECTIVE-DOG-LEASH",
    "title": "Heavy Duty Padded Reflective Dog Leash 1.8m",
    "categoryRef": "CC-PETS",
    "ptCode": "PET_CARE",
    "brandName": "Paw & Pantry Pet Supplies",
    "shortDescription": "Shock-absorbing nylon mountain climbing rope leash with 360-degree swivel carabiner.",
    "description": "12mm thick braided high-density nylon rope with double-sided luminous reflective stitching for evening road walks. Features a soft neoprene-padded handle to protect hands from pulling friction.",
    "basePrice": 165,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-LEASH-1",
      "CMA-PROD-LEASH-2",
      "CMA-PROD-LEASH-3"
    ],
    "attributes": {
      "length": "1.8m",
      "diameter": "12mm",
      "carabiner": "Aircraft Grade Zinc"
    }
  },
  {
    "key": "PROD-STAINLESS-PET-BOWLS",
    "title": "Non-Slip Stainless Steel Dual Pet Feeding Station",
    "categoryRef": "CC-PETS",
    "ptCode": "PET_CARE",
    "brandName": "Cape Pet Nutrition",
    "shortDescription": "Elevated bamboo wooden stand with two dishwasher-safe hygienic stainless steel bowls.",
    "description": "Ergonomically tilted natural bamboo feeder holding two 750ml deep food and water bowls. Silicone rim pads eliminate rattling noise and prevent bowl sliding across tiled kitchen floors.",
    "basePrice": 195,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PETBOWLS-1",
      "CMA-PROD-PETBOWLS-2",
      "CMA-PROD-PETBOWLS-3"
    ],
    "attributes": {
      "capacity": "750ml each",
      "standMaterial": "Bamboo"
    }
  },
  {
    "key": "PROD-NATURAL-DOG-SHAMPOO",
    "title": "Tea Tree and Rooibos Gentle Soothing Dog Shampoo 500ml",
    "categoryRef": "CC-PETS",
    "ptCode": "PET_CARE",
    "brandName": "Cape Pet Nutrition",
    "shortDescription": "pH-balanced botanical shampoo with tea tree oil to repel fleas and soothe dry itchy skin.",
    "description": "Free from artificial parabens, sulphates, and synthetic perfumes. Combines soothing aloe vera, organic rooibos antioxidants, and pure tea tree essential oil to leave canine coats glossy and clean.",
    "basePrice": 115,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PETSHAMPOO-1",
      "CMA-PROD-PETSHAMPOO-2",
      "CMA-PROD-PETSHAMPOO-3"
    ],
    "attributes": {
      "volume": "500ml",
      "pHBalanced": true
    }
  },
  {
    "key": "PROD-ILALA-PALM-BASKET",
    "title": "Handwoven Zulu Ilala Palm Storage Basket 35cm",
    "categoryRef": "CC-DECOR",
    "ptCode": "HOME_LIVING",
    "brandName": "Mzansi Living Spaces",
    "shortDescription": "Authentic handcrafted natural fiber storage basket dyed with indigenous root barks.",
    "description": "Mastercrafted by rural KwaZulu-Natal weavers using sustainably harvested Ilala palm fronds. Sturdy structural weave featuring traditional geometric heritage patterns dyed with boiled bark.",
    "basePrice": 340,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ILALABASKET-1",
      "CMA-PROD-ILALABASKET-2",
      "CMA-PROD-ILALABASKET-3"
    ],
    "attributes": {
      "diameter": "35cm",
      "artisanOrigin": "KwaZulu-Natal"
    }
  },
  {
    "key": "PROD-PROTEA-LINEN-NAPKINS",
    "title": "Pure Flax Linen Protea Print Dinner Napkins 4 Pack",
    "categoryRef": "CC-COOKWARE",
    "ptCode": "HOME_LIVING",
    "brandName": "Mzansi Living Spaces",
    "shortDescription": "Mitered hem natural stone-washed linen napkins hand-printed with botanical proteas.",
    "description": "45x45cm luxury tabletop linen napkins crafted from 100% natural flax. Screen-printed with charcoal protea illustrations using water-based non-toxic inks. Softens luxuriously with every wash.",
    "basePrice": 210,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-NAPKINS-1",
      "CMA-PROD-NAPKINS-2",
      "CMA-PROD-NAPKINS-3"
    ],
    "attributes": {
      "packSize": "4 Pack",
      "dimensions": "45x45cm",
      "fabric": "100% Flax Linen"
    }
  },
  {
    "key": "PROD-CEDAR-BEESWAX-CANDLE",
    "title": "Drakensberg Cedar & Wild Honeycomb Beeswax Candle",
    "categoryRef": "CC-DECOR",
    "ptCode": "HOME_LIVING",
    "brandName": "Mzansi Living Spaces",
    "shortDescription": "Hand-poured pure South African beeswax candle with cedarwood and warm honey aroma.",
    "description": "Poured in a reusable amber glass jar with natural wood wick that crackles softly as it burns. 100% pure local beeswax burns clean for over 45 hours while naturally ionizing indoor air.",
    "basePrice": 155,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BEESCANDLE-1",
      "CMA-PROD-BEESCANDLE-2",
      "CMA-PROD-BEESCANDLE-3"
    ],
    "attributes": {
      "burnTime": "45 Hours",
      "wick": "Natural Wood Crackle"
    }
  },
  {
    "key": "PROD-OLIVE-WOOD-BOARD",
    "title": "Reclaimed Cape Olive Wood Charcuterie Board 45cm",
    "categoryRef": "CC-COOKWARE",
    "ptCode": "HOME_LIVING",
    "brandName": "Outeniqua Woodcraft",
    "shortDescription": "Rustic live-edge solid olive wood serving and carving board finished with beeswax.",
    "description": "Carved from sustainably salvaged fallen Cape olive timber. Distinctive swirling amber grain with natural live bark edges and ergonomic carved thumb handle. Finished with organic food-safe beeswax balm.",
    "basePrice": 380,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-OLIVEBOARD-1",
      "CMA-PROD-OLIVEBOARD-2",
      "CMA-PROD-OLIVEBOARD-3"
    ],
    "attributes": {
      "length": "45cm",
      "timber": "Cape Olive Wood"
    }
  },
  {
    "key": "PROD-CERAMIC-MUG-SAGE",
    "title": "Artisan Wheel-Thrown Stoneware Coffee Mug - Sage",
    "categoryRef": "CC-COOKWARE",
    "ptCode": "HOME_LIVING",
    "brandName": "Karoo Clay and Homeware",
    "shortDescription": "Generous 380ml speckled stoneware mug dipped in a reactive matte sage green glaze.",
    "description": "Individually wheel-thrown in the Karoo using iron-rich local clay. Comfortable thumb-rest loop handle and double-glazed interior. Safe for microwave and daily dishwasher use.",
    "basePrice": 135,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SAGEMUG-1",
      "CMA-PROD-SAGEMUG-2",
      "CMA-PROD-SAGEMUG-3"
    ],
    "attributes": {
      "capacity": "380ml",
      "glaze": "Reactive Matte Sage"
    }
  },
  {
    "key": "PROD-WOVEN-COTTON-RUNNER",
    "title": "Handloomed Table Runner Natural Cotton 180x40cm",
    "categoryRef": "CC-DECOR",
    "ptCode": "HOME_LIVING",
    "brandName": "Mzansi Living Spaces",
    "shortDescription": "Textured unbleached heavy cotton dining table runner finished with knotted fringe.",
    "description": "Woven on wooden shuttle looms using locally grown sustainable cotton yarns. Neutral oatmeal colorway with subtle herringbone texture, providing rustic warmth to wooden dining tables.",
    "basePrice": 220,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-RUNNER-1",
      "CMA-PROD-RUNNER-2",
      "CMA-PROD-RUNNER-3"
    ],
    "attributes": {
      "dimensions": "180x40cm",
      "washInstruction": "Cold Machine Wash"
    }
  },
  {
    "key": "PROD-BRASS-PEPPER-MILL",
    "title": "Traditional Hand-Cranked Brass Pepper Grinder 22cm",
    "categoryRef": "CC-COOKWARE",
    "ptCode": "HOME_LIVING",
    "brandName": "Baobab Kitchen Supplies",
    "shortDescription": "Solid cast brass tabletop pepper mill with hardened steel grinding mechanism.",
    "description": "Classic Ottoman-heritage cylindrical pepper mill crafted in heavy spun brass. Adjustable bottom screw delivers everything from coarse cracked pepper for braai steaks to fine dust for soups.",
    "basePrice": 290,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PEPPERMILL-1",
      "CMA-PROD-PEPPERMILL-2",
      "CMA-PROD-PEPPERMILL-3"
    ],
    "attributes": {
      "height": "22cm",
      "mechanism": "Hardened Carbon Steel"
    }
  },
  {
    "key": "PROD-AROMATIC-DIFFUSER-FYNBOS",
    "title": "Cape Floral Kingdom Essential Oil Reed Diffuser 200ml",
    "categoryRef": "CC-DECOR",
    "ptCode": "HOME_LIVING",
    "brandName": "Mzansi Living Spaces",
    "shortDescription": "Alcohol-free home fragrance diffuser with wild fynbos, bergamot and Cape citrus notes.",
    "description": "Infused with cold-pressed petitgrain, lemon verbena, and indigenous Cape chamomile essential oils. Ten natural rattan reeds disperse a gentle, uplifting fragrance continuously for up to 3 months.",
    "basePrice": 190,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-DIFFUSER-1",
      "CMA-PROD-DIFFUSER-2",
      "CMA-PROD-DIFFUSER-3"
    ],
    "attributes": {
      "volume": "200ml",
      "duration": "Up to 12 Weeks"
    }
  },
  {
    "key": "PROD-SOLAR-LANTERN-CAMPING",
    "title": "Solar & USB Rechargeable Waterproof Camping Lantern",
    "categoryRef": "CC-POWER",
    "ptCode": "ELECTRONICS",
    "brandName": "Circuit House Electronics",
    "shortDescription": "Collapsible 500-lumen LED lantern with built-in solar panel and emergency power bank.",
    "description": "Essential load-shedding and outdoor camping companion. Features dual solar and USB-C recharging, warm dimmable 360-degree LED lighting, magnetic base, and 4,400mAh battery for phone emergency top-ups.",
    "basePrice": 260,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-LANTERN-1",
      "CMA-PROD-LANTERN-2",
      "CMA-PROD-LANTERN-3"
    ],
    "attributes": {
      "brightness": "500 Lumens",
      "batteryCapacity": "4400mAh",
      "waterResistance": "IPX4"
    }
  },
  {
    "key": "PROD-SURGE-PLUG-6WAY",
    "title": "Heavy Duty 6-Way Surge Protected Power Strip with USB",
    "categoryRef": "CC-POWER",
    "ptCode": "ELECTRONICS",
    "brandName": "Circuit House Electronics",
    "shortDescription": "SABS approved 6-socket surge protection multi-plug with dual 2.4A USB fast ports.",
    "description": "Engineered to protect home computers, TVs, and smart devices from power grid spikes and lightning surges. High thermal capacity flame-retardant housing with illuminated master breaker switch.",
    "basePrice": 285,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SURGEPLUG-1",
      "CMA-PROD-SURGEPLUG-2",
      "CMA-PROD-SURGEPLUG-3"
    ],
    "attributes": {
      "surgeRating": "1800 Joules",
      "socketCount": 6,
      "usbPorts": 2
    }
  },
  {
    "key": "PROD-ANC-HEADPHONES-BT",
    "title": "Hybrid Active Noise Cancelling Over-Ear Bluetooth Headphones",
    "categoryRef": "CC-AUDIO",
    "ptCode": "ELECTRONICS",
    "brandName": "Apex Mobile & Audio",
    "shortDescription": "Hi-Res wireless headphones with 35dB active noise cancellation and 40hr battery.",
    "description": "40mm custom dynamic drivers delivering deep punchy bass and crystal-clear highs. Plush memory foam ear cushions provide all-day comfort during work focus or travel, with multi-point device pairing.",
    "basePrice": 780,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-HEADPHONES-1-R2",
      "CMA-PROD-HEADPHONES-2-R2",
      "CMA-PROD-HEADPHONES-3-R2"
    ],
    "attributes": {
      "batteryLife": "40 Hours",
      "ancReduction": "35dB",
      "bluetooth": "5.3"
    }
  },
  {
    "key": "PROD-WATERPROOF-SPEAKER",
    "title": "Rugged IPX7 Waterproof Outdoor Bluetooth Speaker 20W",
    "categoryRef": "CC-AUDIO",
    "ptCode": "ELECTRONICS",
    "brandName": "Apex Mobile & Audio",
    "shortDescription": "Shockproof portable cylinder speaker with dual passive radiators and 16hr battery.",
    "description": "Built for pool parties, camping, and beach trips. Fully immersible IPX7 waterproof silicone body, loud 20W stereo sound, integrated woven hanging loop, and wireless stereo pairing mode.",
    "basePrice": 520,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-WPROOFSPEAKER-1",
      "CMA-PROD-WPROOFSPEAKER-2",
      "CMA-PROD-WPROOFSPEAKER-3"
    ],
    "attributes": {
      "outputPower": "20W",
      "rating": "IPX7 Waterproof",
      "battery": "16 Hours"
    }
  },
  {
    "key": "PROD-WIRELESS-DESK-STAND",
    "title": "Fast 15W Qi-Certified Aluminium Charging Stand",
    "categoryRef": "CC-POWER",
    "ptCode": "ELECTRONICS",
    "brandName": "Silicon Cape Tech",
    "shortDescription": "Minimalist brushed aluminium wireless phone stand with dual charging induction coils.",
    "description": "Holds phones in portrait or landscape orientations at an optimal 60-degree viewing angle for FaceTime calls or desktop notifications. Intelligent chip prevents overheating and protects battery longevity.",
    "basePrice": 245,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CHARGSTAND-1",
      "CMA-PROD-CHARGSTAND-2",
      "CMA-PROD-CHARGSTAND-3"
    ],
    "attributes": {
      "maxOutput": "15W",
      "material": "CNC Brushed Aluminium"
    }
  },
  {
    "key": "PROD-MECHANICAL-KEYBOARD",
    "title": "Compact Tenkeyless Mechanical Keyboard - Brown Switches",
    "categoryRef": "CC-ELECTRONICS",
    "ptCode": "ELECTRONICS",
    "brandName": "Silicon Cape Tech",
    "shortDescription": "Tactile silent mechanical gaming and typing keyboard with white LED backlighting.",
    "description": "Space-saving 87-key TKL layout with quiet tactile brown mechanical switches rated for 50 million keystrokes. Detachable braided USB-C cable and aircraft-grade matte aluminium top plate.",
    "basePrice": 650,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-KEYBOARD-1",
      "CMA-PROD-KEYBOARD-2",
      "CMA-PROD-KEYBOARD-3"
    ],
    "attributes": {
      "layout": "Tenkeyless 87-Key",
      "switches": "Tactile Brown",
      "connection": "USB-C"
    }
  },
  {
    "key": "PROD-DUAL-CAR-CHARGER-45W",
    "title": "Rapid GaN 45W Dual USB-C & USB-A Car Charger",
    "categoryRef": "CC-POWER",
    "ptCode": "ELECTRONICS",
    "brandName": "Circuit House Electronics",
    "shortDescription": "Ultra-compact metal 12V cigarette lighter plug with Power Delivery fast charging.",
    "description": "Sits flush inside vehicle charging sockets. Supports simultaneous rapid fast-charging of laptops, tablets, and smartphones with dynamic power allocation and internal circuit surge protection.",
    "basePrice": 165,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CARCHRG-1",
      "CMA-PROD-CARCHRG-2",
      "CMA-PROD-CARCHRG-3"
    ],
    "attributes": {
      "output": "45W Total PD",
      "ports": "USB-C + USB-A"
    }
  },
  {
    "key": "PROD-SMART-PLUG-WIFI",
    "title": "Smart WiFi Power Monitoring Energy Plug 16A",
    "categoryRef": "CC-POWER",
    "ptCode": "ELECTRONICS",
    "brandName": "Silicon Cape Tech",
    "shortDescription": "Smartphone-controlled 3-pin round South African smart plug with live kWh tracking.",
    "description": "Standard large South African 3-pin plug Type M. Allows scheduled timers, remote off/on control via mobile app, and real-time electrical energy consumption monitoring for geysers and appliances.",
    "basePrice": 175,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SMARTPLUG-1",
      "CMA-PROD-SMARTPLUG-2",
      "CMA-PROD-SMARTPLUG-3"
    ],
    "attributes": {
      "rating": "16A / 3500W",
      "plugType": "Type M - South Africa",
      "connectivity": "WiFi 2.4GHz"
    }
  },
  {
    "key": "PROD-VELLIES-LEATHER-BOOTS",
    "title": "Handmade Kalahari Leather Vellies Classic - Tan",
    "categoryRef": "CC-FOOTWEAR",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Veld Leather Goods",
    "shortDescription": "Traditional South African veldskoen handcrafted in premium oiled nubuck leather.",
    "description": "Heirloom craftsmanship built for rugged gravel trails and comfortable city walking. Features supple 2.2mm full-grain bovine leather, brass eyelets, and durable stitched crepe rubber soles.",
    "basePrice": 790,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-VELLIES-1",
      "CMA-PROD-VELLIES-2",
      "CMA-PROD-VELLIES-3"
    ],
    "attributes": {
      "sole": "Stitched Crepe",
      "upper": "Full-Grain Oiled Bovine"
    }
  },
  {
    "key": "PROD-SHWESHWE-MIDI-SKIRT",
    "title": "Authentic Indigo Three Cats Shweshwe A-Line Skirt",
    "categoryRef": "CC-CLOTHING",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Soweto Textile Workshop",
    "shortDescription": "Structured 100% cotton printed skirt crafted from genuine Da Gama Three Cats fabric.",
    "description": "Classic high-waisted A-line midi skirt with side seam pockets and discreet invisible back zip. Features iconic traditional discharge-printed blue and white geometric South African Shweshwe motifs.",
    "basePrice": 460,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SHWESHWE-1",
      "CMA-PROD-SHWESHWE-2",
      "CMA-PROD-SHWESHWE-3"
    ],
    "attributes": {
      "fabric": "Original Da Gama Cotton",
      "pockets": true
    }
  },
  {
    "key": "PROD-MOHAIR-HIKING-SOCKS",
    "title": "Karoo Mohair Thermal Cushion Hiking Socks 2 Pair",
    "categoryRef": "CC-CLOTHING",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Protea Casualwear",
    "shortDescription": "Ultra-comfortable blister-free hiking socks woven with natural Angora goat mohair.",
    "description": "Naturally moisture-wicking and antimicrobial. Mohair fibers have smooth scales that prevent blister-causing friction, combined with cushioned terry soles for long mountain trail comfort.",
    "basePrice": 195,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MOHAIRSOCKS-1",
      "CMA-PROD-MOHAIRSOCKS-2",
      "CMA-PROD-MOHAIRSOCKS-3"
    ],
    "attributes": {
      "packSize": "2 Pairs",
      "material": "Mohair & Merino Blend"
    }
  },
  {
    "key": "PROD-SAFARI-LINEN-SHIRT",
    "title": "Unisex Washed Linen Safari Camp Collar Shirt - Sand",
    "categoryRef": "CC-CLOTHING",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Protea Casualwear",
    "shortDescription": "Relaxed fit pure linen shirt with cuban camp collar and genuine coconut shell buttons.",
    "description": "Breathable garment-washed flax linen that stays cool under hot African sun. Features twin chest flap pockets, relaxed boxy cut, and side vents designed to be worn untucked.",
    "basePrice": 540,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SAFARISHIRT-1",
      "CMA-PROD-SAFARISHIRT-2",
      "CMA-PROD-SAFARISHIRT-3"
    ],
    "attributes": {
      "material": "100% Washed Linen",
      "color": "Safari Sand"
    }
  },
  {
    "key": "PROD-LEATHER-BELT-STITCHED",
    "title": "Hand-Stitched Full Grain Vegetable Tanned Leather Belt",
    "categoryRef": "CC-ACCESSORIES",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Veld Leather Goods",
    "shortDescription": "Heavyweight 38mm wide genuine leather belt fitted with solid antique brass buckle.",
    "description": "Hand-cut from single 4mm vegetable-tanned steer hide with beveled and hand-burnished edges. Heavy waxed saddle-stitching at stress points guarantees a lifetime of dependable daily wear.",
    "basePrice": 285,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-LEATHERBELT-1",
      "CMA-PROD-LEATHERBELT-2",
      "CMA-PROD-LEATHERBELT-3"
    ],
    "attributes": {
      "width": "38mm",
      "leatherThickness": "4mm",
      "hardware": "Solid Brass"
    }
  },
  {
    "key": "PROD-WIDE-BRIM-SUN-HAT",
    "title": "Crushable Canvas Safari Sun Hat with Chinstrap",
    "categoryRef": "CC-ACCESSORIES",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Table Mountain Apparel",
    "shortDescription": "UPF 50+ broad-brim cotton canvas sun protection hat with breathable brass eyelets.",
    "description": "Designed for full facial and neck sun protection during game drives and coastal walks. Flexible brim retains its shape after pack packing, with adjustable leather chin cord for windy conditions.",
    "basePrice": 230,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SUNHAT-1",
      "CMA-PROD-SUNHAT-2",
      "CMA-PROD-SUNHAT-3"
    ],
    "attributes": {
      "upfProtection": "UPF 50+",
      "material": "Heavy Cotton Duck"
    }
  },
  {
    "key": "PROD-HEAVY-CANVAS-DUFFEL",
    "title": "Waxed Heavy Canvas & Leather Overnight Duffle Bag",
    "categoryRef": "CC-ACCESSORIES",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Veld Leather Goods",
    "shortDescription": "Rugged 40L water-repellent travel bag with full-grain leather base and brass hardware.",
    "description": "Built for bush flights and weekend getaways. 16oz paraffin-waxed cotton canvas body reinforced with thick leather handles, heavy YKK brass two-way zipper, and detachable padded shoulder strap.",
    "basePrice": 680,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CANVASDUFFEL-1",
      "CMA-PROD-CANVASDUFFEL-2",
      "CMA-PROD-CANVASDUFFEL-3"
    ],
    "attributes": {
      "capacity": "40 Litres",
      "zipper": "Heavy YKK Brass"
    }
  },
  {
    "key": "PROD-CHINO-TROUSERS-NAVY",
    "title": "Stretch Cotton Twill Tailored Chino Trousers - Navy",
    "categoryRef": "CC-CLOTHING",
    "ptCode": "FASHION_APPAREL",
    "brandName": "Urban Thread Co",
    "shortDescription": "Modern slim-tapered chinos tailored in comfortable high-recovery stretch cotton twill.",
    "description": "Versatile wardrobe anchor with flat front, slanted side pockets, and buttoned rear welt pockets. Enzyme washed for a broken-in soft handfeel that dresses up or down effortlessly.",
    "basePrice": 420,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-CHINOS-1",
      "CMA-PROD-CHINOS-2",
      "CMA-PROD-CHINOS-3"
    ],
    "attributes": {
      "fit": "Slim Tapered",
      "composition": "98% Cotton 2% Elastane"
    }
  },
  {
    "key": "PROD-CAPE-ALOE-GEL-200ML",
    "title": "Pure Cape Aloe Ferox Soothing Skin Gel 200ml",
    "categoryRef": "CC-PERSONAL-CARE",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Highveld Botanical Remedies",
    "shortDescription": "Certified organic Cape Aloe Ferox gel for sunburn relief, hydration and skin recovery.",
    "description": "Harvested from wild indigenous Aloe Ferox plants in the Albertinia district. Contains 20 times more bitter sap polysaccharides than Aloe Vera, providing rapid cooling relief for sun-exposed and irritated skin.",
    "basePrice": 95,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ALOEGEL-1",
      "CMA-PROD-ALOEGEL-2",
      "CMA-PROD-ALOEGEL-3"
    ],
    "attributes": {
      "volume": "200ml",
      "botanical": "Wild Aloe Ferox"
    }
  },
  {
    "key": "PROD-BUCHU-TINCTURE-50ML",
    "title": "Indigenous Organic Buchu Detox Herbal Drops 50ml",
    "categoryRef": "CC-VITAMINS",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Highveld Botanical Remedies",
    "shortDescription": "Traditional Cape herbal extract supporting urinary tract health and natural inflammation relief.",
    "description": "Pure Agathosma betulina extract prepared according to historic Khoi herbal traditions. Rich in natural bioflavonoids and diosphenol, offering potent natural antiseptic support for kidney and bladder wellness.",
    "basePrice": 140,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BUCHU-1",
      "CMA-PROD-BUCHU-2",
      "CMA-PROD-BUCHU-3"
    ],
    "attributes": {
      "volume": "50ml",
      "extraction": "Hydro-Ethanolic"
    }
  },
  {
    "key": "PROD-MARULA-FACIAL-OIL",
    "title": "Cold-Pressed Virgin Marula Face and Hair Oil 50ml",
    "categoryRef": "CC-PERSONAL-CARE",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Cornerstone Wellness",
    "shortDescription": "Fast-absorbing nutrient-dense luxury beauty oil packed with Vitamin C and oleic acid.",
    "description": "Expeller-pressed from wild marula fruit kernels harvested by women's cooperatives in Limpopo. Delivers deep cellular hydration, restores skin elasticity, and softens hair without greasy residue.",
    "basePrice": 215,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MARULAOIL-1",
      "CMA-PROD-MARULAOIL-2",
      "CMA-PROD-MARULAOIL-3"
    ],
    "attributes": {
      "volume": "50ml",
      "skinType": "All Skin Types"
    }
  },
  {
    "key": "PROD-CHAMOMILE-SLEEP-TEA",
    "title": "Organic Calming Chamomile & Passionflower Tea 20s",
    "categoryRef": "CC-OTC-RELIEF",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Sunbird Herbal Teas",
    "shortDescription": "Caffeine-free botanical night infusion blending whole chamomile blossoms and passionflower.",
    "description": "Expertly blended to promote restful restorative sleep. Pure whole Egyptian chamomile flowers paired with relaxing South African honeybush, lavender buds, and nervine passionflower leaves.",
    "basePrice": 58,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SLEEPTEA-1",
      "CMA-PROD-SLEEPTEA-2",
      "CMA-PROD-SLEEPTEA-3"
    ],
    "attributes": {
      "bagCount": 20,
      "caffeineFree": true
    }
  },
  {
    "key": "PROD-PROBIOTIC-COMPLEX-30S",
    "title": "High-Potency 10-Strain Daily Probiotics 30 Capsules",
    "categoryRef": "CC-VITAMINS",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Northgate Family Health",
    "shortDescription": "20 Billion CFU delayed-release capsules supporting gut microbiome diversity and immunity.",
    "description": "Formulated with 10 clinically researched probiotic strains including Lactobacillus rhamnosus and Bifidobacterium lactis. Acid-resistant DRcaps ensure live cultures survive stomach acids.",
    "basePrice": 195,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-PROBIOTICS-1",
      "CMA-PROD-PROBIOTICS-2",
      "CMA-PROD-PROBIOTICS-3"
    ],
    "attributes": {
      "cfuCount": "20 Billion",
      "count": 30,
      "shelfStable": true
    }
  },
  {
    "key": "PROD-ARNICA-MASSAGE-OIL",
    "title": "Arnica & Wintergreen Soothing Muscle Rub Oil 100ml",
    "categoryRef": "CC-OTC-RELIEF",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Cornerstone Wellness",
    "shortDescription": "Targeted therapeutic warming body oil for post-exercise recovery and sore joint stiffness.",
    "description": "Combines high-concentration arnica montana extract with pure wintergreen, camphor, and peppermint essential oils in a nourishing sweet almond oil base to stimulate blood flow and ease muscular knots.",
    "basePrice": 110,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ARNICAOIL-1",
      "CMA-PROD-ARNICAOIL-2",
      "CMA-PROD-ARNICAOIL-3"
    ],
    "attributes": {
      "volume": "100ml",
      "scent": "Warming Herbal Menthol"
    }
  },
  {
    "key": "PROD-SUNSCREEN-SPF50-150ML",
    "title": "Reef-Safe Mineral Sunscreen SPF 50 Broad Spectrum 150ml",
    "categoryRef": "CC-PERSONAL-CARE",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Northgate Family Health",
    "shortDescription": "Non-nano zinc oxide water-resistant sunscreen with antioxidant rooibos and coconut.",
    "description": "Maximum UVA/UVB barrier protection that is ocean-safe and gentle on sensitive skin. 80-minute water resistance formula rubs in clear without chalky white residue, fortified with Vitamin E.",
    "basePrice": 175,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-SUNSCREEN-1",
      "CMA-PROD-SUNSCREEN-2",
      "CMA-PROD-SUNSCREEN-3"
    ],
    "attributes": {
      "spfRating": 50,
      "waterResistance": "80 Minutes",
      "reefSafe": true
    }
  },
  {
    "key": "PROD-ELECTROLYTE-HYDRATION",
    "title": "Clean Hydration Electrolyte Powder Packets 10 Pack",
    "categoryRef": "CC-VITAMINS",
    "ptCode": "HEALTH_WELLNESS",
    "brandName": "Cornerstone Wellness",
    "shortDescription": "Zero-sugar rapid cellular hydration drink mix with potassium, magnesium and sodium.",
    "description": "Formulated according to World Health Organization oral rehydration science. Delicious naturally flavored lemon-lime single-serve stick packs designed to dissolve instantly in cold water.",
    "basePrice": 120,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-ELECTROLYTE-1",
      "CMA-PROD-ELECTROLYTE-2",
      "CMA-PROD-ELECTROLYTE-3"
    ],
    "attributes": {
      "servings": 10,
      "sugarGrams": 0,
      "flavor": "Lemon Lime"
    }
  },
  {
    "key": "PROD-BOBOTIE-MEAL-KIT",
    "title": "Cape Malay Spiced Beef Bobotie Family Meal Kit",
    "categoryRef": "CC-TRADITIONAL",
    "ptCode": "FOOD_DINING",
    "brandName": "Bree Street Artisans",
    "shortDescription": "Authentic fragrant baked spiced minced beef with savory golden egg custard topping.",
    "description": "Generously seasoned minced beef cooked with sweet dried apricots, sultanas, toasted almonds, and aromatic turmeric curry spices, crowned with creamy egg custard and bay leaves. Includes yellow geelrys.",
    "basePrice": 165,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BOBOTIE-1",
      "CMA-PROD-BOBOTIE-2",
      "CMA-PROD-BOBOTIE-3"
    ],
    "attributes": {
      "servings": "4 People",
      "preparation": "Oven Bake 25min"
    }
  },
  {
    "key": "PROD-KAROO-LAMB-CHOPS",
    "title": "Rosemary & Garlic Marinated Karoo Lamb Chops 600g",
    "categoryRef": "CC-GRILL",
    "ptCode": "FOOD_DINING",
    "brandName": "Red Ember Kitchen",
    "shortDescription": "Tender Karoo loin lamb chops vacuum marinated in wild rosemary, garlic and olive oil.",
    "description": "Certified Karoo lamb grazed on wild aromatic scrub. Hand-cut 6-chop pack marinated with crushed garlic cloves, fresh garden rosemary, and black pepper. Perfect for wood-fired braai grilling.",
    "basePrice": 185,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-LAMBCHOPS-1",
      "CMA-PROD-LAMBCHOPS-2",
      "CMA-PROD-LAMBCHOPS-3"
    ],
    "attributes": {
      "weight": "600g",
      "cut": "Loin Chops",
      "origin": "Great Karoo"
    }
  },
  {
    "key": "PROD-BOEREWORS-BRAAI-PACK",
    "title": "Traditional Farm Boerewors 800g Braai Pack",
    "categoryRef": "CC-GRILL",
    "ptCode": "FOOD_DINING",
    "brandName": "Braam Grill House",
    "shortDescription": "Coarse-ground prime beef and pork sausage seasoned with roasted coriander and nutmeg.",
    "description": "Traditional 90% meat ratio recipe stuffed in natural hog casings with no artificial fillers. Seasoned with toasted cracked coriander seeds, cloves, black pepper, and Worcestershire vinegar.",
    "basePrice": 125,
    "condition": "NEW",
    "sellingUnit": "FIXED_WEIGHT",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BOERIEPACK-1",
      "CMA-PROD-BOERIEPACK-2",
      "CMA-PROD-BOERIEPACK-3"
    ],
    "attributes": {
      "weight": "800g",
      "meatPercentage": 90
    }
  },
  {
    "key": "PROD-PERI-HALF-CHICKEN",
    "title": "Flame-Grilled Lemon & Herb Spatchcock Half Chicken",
    "categoryRef": "CC-GRILL",
    "ptCode": "FOOD_DINING",
    "brandName": "Red Ember Kitchen",
    "shortDescription": "Succulent grain-fed half chicken flame-seared over hardwood charcoal with citrus baste.",
    "description": "Spatchcocked for even cooking, marinated 24 hours in lemon juice, garlic, fresh oregano, and mild African bird's eye chili, then crisped over red-hot glowing coals for smoky charred tenderness.",
    "basePrice": 110,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-HALFCHICK-1",
      "CMA-PROD-HALFCHICK-2",
      "CMA-PROD-HALFCHICK-3"
    ],
    "attributes": {
      "spiceLevel": "Medium",
      "portion": "Half Chicken"
    }
  },
  {
    "key": "PROD-DURBAN-MUTTON-CURRY",
    "title": "Authentic Slow-Cooked Durban Mutton Curry with Basmati",
    "categoryRef": "CC-TRADITIONAL",
    "ptCode": "FOOD_DINING",
    "brandName": "Durban Spice Table",
    "shortDescription": "Rich dark mutton curry simmered on the bone with soft melting potatoes and cumin rice.",
    "description": "Famous KwaZulu-Natal slow-cooked mutton curry packed with whole cardamom pods, cinnamon sticks, curry leaves, and toasted garam masala. Served with fluffy basmati rice and tangy carrot salad.",
    "basePrice": 145,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MUTTONCURRY-1",
      "CMA-PROD-MUTTONCURRY-2",
      "CMA-PROD-MUTTONCURRY-3"
    ],
    "attributes": {
      "heatLevel": "Hot",
      "sideIncluded": "Basmati Rice & Sambals"
    }
  },
  {
    "key": "PROD-BRAAI-BROODJIE-KIT",
    "title": "Artisan Sourdough Braai Broodjie Kit with Chutney & Gouda",
    "categoryRef": "CC-TRADITIONAL",
    "ptCode": "FOOD_DINING",
    "brandName": "Bree Street Artisans",
    "shortDescription": "Complete fresh ingredients kit for 4 authentic South African braai toasties.",
    "description": "Includes sliced sourdough farmhouse bread, mature aged Gouda cheese, sweet red onions, ripe farm tomatoes, and a jar of Mrs Ball's peach chutney ready to grill over glowing charcoal embers.",
    "basePrice": 75,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BROODJIE-1",
      "CMA-PROD-BROODJIE-2",
      "CMA-PROD-BROODJIE-3"
    ],
    "attributes": {
      "sandwichCount": 4,
      "includesChutney": true
    }
  },
  {
    "key": "PROD-MALVA-PUDDING-DESSERT",
    "title": "Traditional Warm Malva Pudding with Vanilla Custard",
    "categoryRef": "CC-TRADITIONAL",
    "ptCode": "FOOD_DINING",
    "brandName": "Bree Street Artisans",
    "shortDescription": "Spongy caramelized apricot jam baked pudding drenched in rich warm cream butter sauce.",
    "description": "Classic Cape dessert with a moist spongy caramelized texture made with apricot conserve and balsamic vinegar, served with a tub of velvet Madagascar vanilla bean custard.",
    "basePrice": 65,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-MALVAPUD-1",
      "CMA-PROD-MALVAPUD-2",
      "CMA-PROD-MALVAPUD-3"
    ],
    "attributes": {
      "portion": "2-3 Servings",
      "heatingTime": "2min Microwave"
    }
  },
  {
    "key": "PROD-SMOKED-BEEF-BRISKET",
    "title": "12-Hour Oak-Smoked Beef Brisket Platter with Slaw",
    "categoryRef": "CC-GRILL",
    "ptCode": "FOOD_DINING",
    "brandName": "Braam Grill House",
    "shortDescription": "Melt-in-your-mouth slow smoked prime brisket slices with tangy apple cider BBQ glaze.",
    "description": "Smoked low-and-slow over seasoned French oak logs for 12 hours. Thick juicy slices with deep pink smoke ring and peppery bark crust, served with crunchy purple cabbage slaw and pickles.",
    "basePrice": 175,
    "condition": "NEW",
    "sellingUnit": "EACH",
    "inventoryTrackingMode": "TRACKED",
    "imageKeys": [
      "CMA-PROD-BRISKET-1",
      "CMA-PROD-BRISKET-2",
      "CMA-PROD-BRISKET-3"
    ],
    "attributes": {
      "weight": "400g Brisket",
      "smokeWood": "French Oak"
    }
  }
];
