// Cost computation helpers.
// cost_per_meal = Σ (ingredient.package_price / ingredient.servings_per_package)
// across a food's ingredients. Ingredients with missing or zero values
// contribute 0 (don't blow up the sum).

const costPerMealFromIngredients = (ingredients) => {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return 0
  let total = 0
  for (const ing of ingredients) {
    const price = parseFloat(ing.package_price)
    const servings = parseFloat(ing.servings_per_package)
    if (Number.isFinite(price) && Number.isFinite(servings) && servings > 0) {
      total += price / servings
    }
  }
  // Round to cents for stable output.
  return Math.round(total * 100) / 100
}

const perMealCost = (ingredient) => {
  const price = parseFloat(ingredient.package_price)
  const servings = parseFloat(ingredient.servings_per_package)
  if (!Number.isFinite(price) || !Number.isFinite(servings) || servings <= 0) return null
  return Math.round((price / servings) * 100) / 100
}

module.exports = { costPerMealFromIngredients, perMealCost }
