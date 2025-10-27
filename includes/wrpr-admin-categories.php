<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class WRPR_Admin_Categories {

    /**
     * Option key used to persist categories in the database.
     *
     * @var string
     */
    private static $option_key = 'wrpr_categories';

    /**
     * Retrieve the stored categories.
     *
     * @return array
     */
    public static function get_categories() {
        $categories = get_option( self::$option_key, array() );

        return is_array( $categories ) ? $categories : array();
    }

    /**
     * Add a category to the stored list.
     *
     * @param string $name Category display name.
     *
     * @return void
     */
    public static function add_category( $name ) {
        $name = sanitize_text_field( $name );

        if ( '' === $name ) {
            return;
        }

        $slug       = sanitize_title( $name );
        $categories = self::get_categories();

        foreach ( $categories as $category ) {
            if ( isset( $category['slug'] ) && $category['slug'] === $slug ) {
                return;
            }
        }

        $categories[] = array(
            'name' => $name,
            'slug' => $slug,
        );

        update_option( self::$option_key, $categories );
    }

    /**
     * Delete a category by slug.
     *
     * @param string $slug Category slug.
     *
     * @return void
     */
    public static function delete_category( $slug ) {
        $slug = sanitize_title( $slug );

        if ( '' === $slug ) {
            return;
        }

        $categories = array_filter(
            self::get_categories(),
            static function ( $category ) use ( $slug ) {
                return isset( $category['slug'] ) && $category['slug'] !== $slug;
            }
        );

        update_option( self::$option_key, array_values( $categories ) );
    }

    /**
     * Render the category management page.
     *
     * @return void
     */
    public static function render_page() {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        if ( isset( $_POST['wrpr_add_category'] ) ) {
            check_admin_referer( 'wrpr_manage_categories_action', 'wrpr_manage_categories_nonce' );

            $category_name = isset( $_POST['wrpr_new_category'] ) ? wp_unslash( $_POST['wrpr_new_category'] ) : '';
            self::add_category( $category_name );

            wp_safe_redirect( admin_url( 'admin.php?page=wrpr-manage-categories' ) );
            exit;
        }

        if ( isset( $_GET['delete'] ) ) {
            $slug  = isset( $_GET['delete'] ) ? sanitize_title( wp_unslash( $_GET['delete'] ) ) : '';
            $nonce = isset( $_GET['_wpnonce'] ) ? wp_unslash( $_GET['_wpnonce'] ) : '';

            if ( '' !== $slug && wp_verify_nonce( $nonce, 'wrpr_delete_category_' . $slug ) ) {
                self::delete_category( $slug );

                wp_safe_redirect( admin_url( 'admin.php?page=wrpr-manage-categories' ) );
                exit;
            }
        }

        $categories = self::get_categories();

        echo '<div class="wrap">';
        echo '<h1>' . esc_html__( 'Manage Categories', 'wrpr' ) . '</h1>';
        echo '<form method="POST" style="margin-bottom:15px;">';
        wp_nonce_field( 'wrpr_manage_categories_action', 'wrpr_manage_categories_nonce' );
        echo '<input type="text" name="wrpr_new_category" placeholder="' . esc_attr__( 'Add new category', 'wrpr' ) . '" /> ';
        echo '<input type="submit" name="wrpr_add_category" class="button button-primary" value="' . esc_attr__( 'Add Category', 'wrpr' ) . '" />';
        echo '</form>';

        if ( empty( $categories ) ) {
            echo '<p>' . esc_html__( 'No categories yet.', 'wrpr' ) . '</p>';
        } else {
            echo '<table class="widefat"><thead><tr><th>' . esc_html__( 'Name', 'wrpr' ) . '</th><th>' . esc_html__( 'Slug', 'wrpr' ) . '</th><th>' . esc_html__( 'Actions', 'wrpr' ) . '</th></tr></thead><tbody>';

            foreach ( $categories as $category ) {
                $slug      = isset( $category['slug'] ) ? $category['slug'] : '';
                $delete_url = '';

                if ( '' !== $slug ) {
                    $delete_url = wp_nonce_url(
                        add_query_arg(
                            array(
                                'page'   => 'wrpr-manage-categories',
                                'delete' => $slug,
                            ),
                            admin_url( 'admin.php' )
                        ),
                        'wrpr_delete_category_' . $slug
                    );
                }

                echo '<tr>';
                echo '<td>' . esc_html( isset( $category['name'] ) ? $category['name'] : '' ) . '</td>';
                echo '<td>' . esc_html( $slug ) . '</td>';
                echo '<td>';

                if ( '' !== $delete_url ) {
                    echo '<a href="' . esc_url( $delete_url ) . '">' . esc_html__( 'Delete', 'wrpr' ) . '</a>';
                }

                echo '</td>';
                echo '</tr>';
            }

            echo '</tbody></table>';
        }

        echo '</div>';
    }
}
