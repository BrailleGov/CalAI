import type { Recipe, RecipeIngredient } from '../types';
import { SEED_FOODS } from './seedFoods';

const byId = new Map(SEED_FOODS.map((food) => [food.id, food]));

type CuratedItem = [seedId: string, quantity: number];

function ingredient(seedId: string, quantity: number): RecipeIngredient {
  const food = byId.get(`seed-${seedId}`);
  if (!food) {
    throw new Error(`Unknown curated ingredient: ${seedId}`);
  }
  return {
    foodId: food.id,
    name: food.name,
    servingLabel: food.servingLabel,
    quantity,
    nutrients: { ...food.nutrients }
  };
}

function bookRecipe(input: {
  slug: string;
  name: string;
  description: string;
  servings: number;
  tags: string[];
  items: CuratedItem[];
  instructions: string[];
}): Recipe {
  return {
    id: `book-${input.slug}`,
    name: input.name,
    description: input.description,
    servings: input.servings,
    tags: input.tags,
    instructions: input.instructions,
    ingredients: input.items.map(([seedId, quantity]) => ingredient(seedId, quantity)),
    source: 'curated',
    createdAt: 0,
    updatedAt: 0
  };
}

/**
 * A small recipe book built from the same seed foods used by the diary. Nutrition is
 * computed from those ingredient values, so it stays consistent with logging.
 */
export const CURATED_RECIPES: Recipe[] = [
  bookRecipe({
    slug: 'chicken-rice-bowl',
    name: 'Chicken rice bowl',
    description: 'A weeknight bowl with lean chicken, brown rice, and steamed broccoli.',
    servings: 2,
    tags: ['High protein', 'Quick meals', 'Meal prep'],
    items: [
      ['chicken-breast', 1.5],
      ['brown-rice', 1],
      ['broccoli', 2],
      ['olive-oil', 0.5],
      ['soy-sauce', 1]
    ],
    instructions: [
      'Cook the brown rice according to the packet.',
      'Season the chicken with pepper and pan-sear in half the olive oil until cooked through.',
      'Steam the broccoli for 4–5 minutes, then toss with the remaining oil and soy sauce.',
      'Slice the chicken, divide rice and broccoli between two bowls, and top with chicken.'
    ]
  }),
  bookRecipe({
    slug: 'mediterranean-chickpea-salad',
    name: 'Mediterranean chickpea salad',
    description: 'A no-cook lunch with chickpeas, crunchy vegetables, feta, and lemon.',
    servings: 2,
    tags: ['Vegetarian', 'Mediterranean', 'Quick meals', 'No cook'],
    items: [
      ['chickpeas', 1],
      ['cucumber', 1],
      ['tomato', 1],
      ['feta', 2],
      ['olive-oil', 1],
      ['lemon', 0.5]
    ],
    instructions: [
      'Drain and rinse the chickpeas.',
      'Dice the cucumber and tomato; crumble the feta.',
      'Whisk the olive oil with lemon juice, salt, and pepper.',
      'Toss everything together and rest for 10 minutes before serving.'
    ]
  }),
  bookRecipe({
    slug: 'tofu-vegetable-stir-fry',
    name: 'Tofu vegetable stir-fry',
    description: 'Crisp tofu and vegetables in a quick soy-garlic sauce.',
    servings: 2,
    tags: ['Vegan', 'High protein', 'Asian', 'Quick meals'],
    items: [
      ['tofu', 2],
      ['broccoli', 2],
      ['bell-pepper', 1],
      ['garlic', 2],
      ['soy-sauce', 2],
      ['avocado-oil', 1]
    ],
    instructions: [
      'Press the tofu for 10 minutes, then cut into cubes.',
      'Heat the oil in a wide pan and brown the tofu on all sides.',
      'Add garlic, broccoli, and pepper; stir-fry for 4–5 minutes.',
      'Add soy sauce, toss to coat, and serve hot.'
    ]
  }),
  bookRecipe({
    slug: 'greek-yogurt-berry-bowl',
    name: 'Greek yogurt berry bowl',
    description: 'A five-minute breakfast with yogurt, berries, oats, and honey.',
    servings: 1,
    tags: ['Vegetarian', 'High protein', 'Quick meals', 'Breakfast'],
    items: [
      ['greek-yogurt', 1],
      ['blueberries', 0.5],
      ['strawberries', 0.5],
      ['granola', 0.5],
      ['honey', 1]
    ],
    instructions: [
      'Spoon the yogurt into a bowl.',
      'Top with berries and granola.',
      'Drizzle with honey and eat straight away so the granola stays crisp.'
    ]
  }),
  bookRecipe({
    slug: 'lentil-vegetable-soup',
    name: 'Lentil vegetable soup',
    description: 'A freezer-friendly pot of lentils, tomato, carrot, and onion.',
    servings: 4,
    tags: ['Vegan', 'Mediterranean', 'Meal prep', 'Budget'],
    items: [
      ['lentils', 2],
      ['tomato-sauce', 2],
      ['carrot', 1],
      ['onion', 1],
      ['garlic', 2],
      ['olive-oil', 1]
    ],
    instructions: [
      'Dice the onion, carrot, and garlic.',
      'Soften the vegetables in olive oil for 6–8 minutes.',
      'Add lentils, tomato sauce, and enough water to cover by 3 cm.',
      'Simmer for 25–30 minutes until the lentils are tender, then season.'
    ]
  }),
  bookRecipe({
    slug: 'salmon-potato-traybake',
    name: 'Salmon and potato traybake',
    description: 'One tray, minimal washing up: salmon, potatoes, asparagus, and lemon.',
    servings: 2,
    tags: ['Pescatarian', 'High protein', 'Mediterranean'],
    items: [
      ['salmon', 2],
      ['potato', 2],
      ['asparagus', 2],
      ['olive-oil', 1],
      ['lemon', 1]
    ],
    instructions: [
      'Heat the oven to 220 °C and chop the potatoes into wedges.',
      'Toss potatoes with half the oil and roast for 20 minutes.',
      'Add salmon and asparagus, drizzle with the remaining oil, and roast for 12 minutes.',
      'Finish with lemon juice and season to taste.'
    ]
  }),
  bookRecipe({
    slug: 'turkey-avocado-sandwich',
    name: 'Turkey avocado sandwich',
    description: 'A fast lunch with whole wheat bread, turkey, avocado, and greens.',
    servings: 1,
    tags: ['High protein', 'Quick meals', 'Lunch'],
    items: [
      ['bread-ww', 2],
      ['turkey-breast', 1],
      ['avocado', 0.5],
      ['romaine', 1],
      ['mustard', 1]
    ],
    instructions: [
      'Toast the bread if you like.',
      'Spread mustard on one slice and mashed avocado on the other.',
      'Layer turkey and lettuce, close the sandwich, and cut in half.'
    ]
  }),
  bookRecipe({
    slug: 'beef-taco-bowl',
    name: 'Beef taco bowl',
    description: 'Seasoned beef, beans, corn, and salsa over crunchy lettuce.',
    servings: 2,
    tags: ['High protein', 'Latin American', 'Quick meals'],
    items: [
      ['ground-beef', 2],
      ['black-beans', 1],
      ['corn', 0.5],
      ['salsa', 4],
      ['romaine', 2],
      ['cheddar', 1]
    ],
    instructions: [
      'Brown the beef in a hot pan and season with salt, pepper, and cumin if you have it.',
      'Warm the beans and corn.',
      'Pile lettuce into bowls and add beef, beans, corn, salsa, and cheese.'
    ]
  }),
  bookRecipe({
    slug: 'overnight-oats',
    name: 'Peanut butter overnight oats',
    description: 'Prepare two jars tonight for a grab-and-go breakfast.',
    servings: 2,
    tags: ['Vegetarian', 'Breakfast', 'Meal prep', 'Quick meals'],
    items: [
      ['oats', 2],
      ['milk-2', 1],
      ['chia', 0.5],
      ['banana', 1],
      ['peanut-butter', 0.5]
    ],
    instructions: [
      'Stir oats, milk, and chia together in two jars.',
      'Cover and refrigerate overnight.',
      'Top with sliced banana and peanut butter before eating.'
    ]
  }),
  bookRecipe({
    slug: 'chicken-curry-rice',
    name: 'Yogurt chicken curry',
    description: 'A mild, creamy curry made with pantry spices and yogurt.',
    servings: 3,
    tags: ['High protein', 'Indian', 'Meal prep'],
    items: [
      ['chicken-thigh', 3],
      ['greek-yogurt', 1],
      ['tomato-sauce', 2],
      ['onion', 1],
      ['garlic', 2],
      ['basmati-rice', 2]
    ],
    instructions: [
      'Dice the onion and garlic and soften in a pot.',
      'Add the chicken and cook until browned.',
      'Stir in tomato sauce and your curry spices; simmer for 15 minutes.',
      'Take the pot off the heat and stir in the yogurt. Serve with rice.'
    ]
  }),
  bookRecipe({
    slug: 'vegetable-pasta',
    name: 'Vegetable pasta',
    description: 'Whole wheat pasta with a light tomato and vegetable sauce.',
    servings: 2,
    tags: ['Vegetarian', 'Italian', 'Quick meals'],
    items: [
      ['whole-wheat-pasta', 2],
      ['tomato-sauce', 2],
      ['zucchini', 1],
      ['mushrooms', 1],
      ['parmesan', 2],
      ['olive-oil', 1]
    ],
    instructions: [
      'Boil the pasta until al dente.',
      'Sauté zucchini and mushrooms in olive oil for 5 minutes.',
      'Add tomato sauce and simmer for 5 minutes.',
      'Toss with pasta and finish with parmesan.'
    ]
  })
];
