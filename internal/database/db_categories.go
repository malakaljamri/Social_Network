package database

import (
	"forum-project/internal/models"
	"log"
)

func CreateCategory(category *models.Category) error {
	query := `INSERT INTO categories (name) VALUES (?)`
	result, err := ExecuteQuery(query, category.Name)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	category.ID = int(id)
	return nil
}

func GetCategories() ([]models.Category, error) {
	query := `
        SELECT c.id, c.name, COUNT(pc.post_id) as post_count
        FROM categories c
        LEFT JOIN post_categories pc ON c.id = pc.category_id
        GROUP BY c.id
        ORDER BY c.name
    `
	log.SetFlags(log.LstdFlags | log.Lshortfile)
    rows, err := db.Query(query)
    if err != nil {
        log.Printf("Error executing query: %v", err)
        return nil, err
    }
    defer rows.Close()

    var categories []models.Category
    for rows.Next() {
        var cat models.Category
        err := rows.Scan(&cat.ID, &cat.Name, &cat.PostCount)
        if err != nil {
            log.Printf("Error scanning row: %v", err)
            return nil, err
        }
        // log.Printf("Category fetched: ID=%d, Name=%s, PostCount=%d", cat.ID, cat.Name, cat.PostCount)
        categories = append(categories, cat)
    }

    return categories, nil
}

func DeleteCategory(categoryID int) error {
	query := `DELETE FROM categories WHERE id = ?`
	_, err := ExecuteQuery(query, categoryID)
	return err
}
