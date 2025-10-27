<?php
if ( ! defined( 'ABSPATH' ) ) exit;

require_once WRPR_PATH . 'includes/wrpr-admin-categories.php';
require_once WRPR_PATH . 'includes/wrpr-admin-readers.php';

class WRPR_Admin_Edit {

    public static function render_edit_page( $reader_id ) {
        $readers = WRPR_Admin_Readers::get_readers();
        if ( ! isset( $readers[ $reader_id ] ) ) {
            echo '<div class="wrap"><h1>Reader Not Found</h1></div>';
            return;
        }

        $reader     = $readers[ $reader_id ];
        $books      = isset( $reader['books'] ) ? $reader['books'] : array();
        $categories = WRPR_Admin_Categories::get_categories();

        // Save updates
        if ( isset( $_POST['wrpr_update_books'] ) ) {
            $new_books = array();

            if ( isset( $_POST['book_title'] ) && is_array( $_POST['book_title'] ) ) {
                foreach ( $_POST['book_title'] as $i => $title ) {
                    $title = sanitize_text_field( $title );

                    if ( ! empty( $_POST['book_delete'][ $i ] ) ) {
                        continue;
                    }

                    if ( empty( $title ) ) {
                        continue;
                    }

                    $new_books[] = array(
                        'title'     => $title,
                        'author'    => sanitize_text_field( $_POST['book_author'][ $i ] ?? '' ),
                        'language'  => sanitize_text_field( $_POST['book_language'][ $i ] ?? '' ),
                        'image_url' => esc_url_raw( $_POST['book_image'][ $i ] ?? '' ),
                        'pdf_url'   => esc_url_raw( $_POST['book_pdf'][ $i ] ?? '' ),
                        'buy_link'  => esc_url_raw( $_POST['book_buy'][ $i ] ?? '' ),
                    );
                }
            }

            $reader['books']      = $new_books;
            $readers[ $reader_id ] = $reader;

            WRPR_Admin_Readers::save_readers( $readers );

            echo '<div class="updated notice"><p><strong>Reader updated successfully.</strong></p></div>';
        }

        echo '<div class="wrap"><h1>Manage Books for: ' . esc_html( $reader['name'] ) . '</h1>';
        echo '<form method="POST">';
        echo '<table class="widefat"><thead><tr>
                <th>Title</th><th>Author</th><th>Language</th>
                <th>Image URL</th><th>PDF URL</th><th>Buy Link</th><th>Delete</th>
              </tr></thead><tbody>';

        $row_count = max( count( $books ), 1 );

        for ( $i = 0; $i < $row_count + 1; $i++ ) {
            $book = $books[ $i ] ?? array(
                'title'     => '',
                'author'    => '',
                'language'  => '',
                'image_url' => '',
                'pdf_url'   => '',
                'buy_link'  => '',
            );

            echo '<tr>';
            echo '<td><input type="text" name="book_title[]" value="' . esc_attr( $book['title'] ) . '" placeholder="Book title" /></td>';
            echo '<td><input type="text" name="book_author[]" value="' . esc_attr( $book['author'] ) . '" placeholder="Author" /></td>';

            echo '<td><select name="book_language[]">';
            echo '<option value="">Select</option>';
            foreach ( $categories as $cat ) {
                $selected = selected( $book['language'], $cat['name'], false );
                echo '<option value="' . esc_attr( $cat['name'] ) . '"' . $selected . '>' . esc_html( $cat['name'] ) . '</option>';
            }
            echo '</select></td>';

            echo '<td><input type="text" name="book_image[]" value="' . esc_attr( $book['image_url'] ) . '" placeholder="Image URL" /></td>';
            echo '<td><input type="text" name="book_pdf[]" value="' . esc_attr( $book['pdf_url'] ) . '" placeholder="PDF URL" /></td>';
            echo '<td><input type="text" name="book_buy[]" value="' . esc_attr( $book['buy_link'] ) . '" placeholder="Buy Link" /></td>';
            echo '<td><input type="checkbox" name="book_delete[' . $i . ']" /></td>';
            echo '</tr>';
        }

        echo '</tbody></table>';
        echo '<p><input type="submit" class="button button-primary" name="wrpr_update_books" value="Update Reader Record" /></p>';
        echo '</form></div>';
    }
}
