<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class WRPR_Admin_Readers {

    private static $option_key = 'wrpr_readers';

    public static function get_readers() {
        $readers = get_option( self::$option_key, array() );

        return is_array( $readers ) ? $readers : array();
    }

    public static function save_readers( $readers ) {
        update_option( self::$option_key, is_array( $readers ) ? $readers : array() );
    }

    public static function add_reader( $name, $slug = '' ) {
        $name = sanitize_text_field( $name );
        $slug = $slug ? sanitize_title( $slug ) : sanitize_title( $name );
        $readers = self::get_readers();

        $id = uniqid( 'wrpr_', true );
        $readers[ $id ] = array(
            'id'    => $id,
            'name'  => $name,
            'slug'  => $slug,
            'books' => array(),
        );

        self::save_readers( $readers );
    }

    public static function delete_reader( $id ) {
        $readers = self::get_readers();
        unset( $readers[ $id ] );
        self::save_readers( $readers );
    }

    public static function duplicate_reader( $id ) {
        $readers = self::get_readers();
        if ( ! isset( $readers[ $id ] ) ) {
            return;
        }

        $original           = $readers[ $id ];
        $copy_id            = uniqid( 'wrpr_', true );
        $original['id']     = $copy_id;
        $original['name']  .= ' Copy';
        $original['slug']   = sanitize_title( $original['slug'] . '-copy' );
        $readers[ $copy_id ] = $original;

        self::save_readers( $readers );
    }

    public static function render_page() {
        if ( isset( $_GET['edit'] ) ) {
            $reader_id = sanitize_text_field( wp_unslash( $_GET['edit'] ) );

            require_once WRPR_PATH . 'includes/wrpr-admin-edit.php';
            WRPR_Admin_Edit::render_edit_page( $reader_id );

            return;
        }

        if ( isset( $_POST['wrpr_create_reader'] ) && ! empty( $_POST['wrpr_reader_name'] ) ) {
            if ( ! isset( $_POST['wrpr_reader_nonce'] ) || ! wp_verify_nonce( wp_unslash( $_POST['wrpr_reader_nonce'] ), 'wrpr_manage_readers' ) ) {
                wp_die( esc_html__( 'Security check failed. Please try again.', 'wrpr' ) );
            }

            $name = sanitize_text_field( wp_unslash( $_POST['wrpr_reader_name'] ) );
            $slug = isset( $_POST['wrpr_reader_slug'] ) ? sanitize_title( wp_unslash( $_POST['wrpr_reader_slug'] ) ) : '';

            self::add_reader( $name, $slug );
        }

        if ( isset( $_GET['delete'] ) && isset( $_GET['_wpnonce'] ) && wp_verify_nonce( wp_unslash( $_GET['_wpnonce'] ), 'wrpr_delete_reader' ) ) {
            self::delete_reader( sanitize_text_field( wp_unslash( $_GET['delete'] ) ) );
        }

        if ( isset( $_GET['duplicate'] ) && isset( $_GET['_wpnonce'] ) && wp_verify_nonce( wp_unslash( $_GET['_wpnonce'] ), 'wrpr_duplicate_reader' ) ) {
            self::duplicate_reader( sanitize_text_field( wp_unslash( $_GET['duplicate'] ) ) );
        }

        $readers = self::get_readers();

        echo '<div class="wrap"><h1>Manage Readers</h1>';
        echo '<form method="POST" style="margin-bottom:15px;">';
        wp_nonce_field( 'wrpr_manage_readers', 'wrpr_reader_nonce' );
        echo '<input type="text" name="wrpr_reader_name" placeholder="Reader name" required /> ';
        echo '<input type="text" name="wrpr_reader_slug" placeholder="Slug (optional)" /> ';
        echo '<input type="submit" class="button button-primary" name="wrpr_create_reader" value="Create Reader" />';
        echo '</form>';

        if ( empty( $readers ) ) {
            echo '<p>No readers found.</p>';
        } else {
            echo '<table class="widefat"><thead><tr><th>Name</th><th>Slug</th><th>Books</th><th>Shortcode</th><th>Actions</th></tr></thead><tbody>';
            foreach ( $readers as $reader ) {
                $shortcode    = '[wrpr_reader id="' . esc_attr( $reader['id'] ) . '"]';
                $books_count  = isset( $reader['books'] ) && is_array( $reader['books'] ) ? count( $reader['books'] ) : 0;
                $page_url      = admin_url( 'admin.php' );
                $delete_url    = wp_nonce_url( add_query_arg( array( 'page' => 'wrpr-manage-readers', 'delete' => $reader['id'] ), $page_url ), 'wrpr_delete_reader' );

                echo '<tr>';
                echo '<td>' . esc_html( $reader['name'] ) . '</td>';
                echo '<td>' . esc_html( $reader['slug'] ) . '</td>';
                echo '<td>' . absint( $books_count ) . '</td>';
                echo '<td><input type="text" readonly value="' . esc_attr( $shortcode ) . '" style="width:240px" /></td>';
                echo '<td><a href="?page=wrpr-edit&reader_id=' . esc_attr( $reader['id'] ) . '">Edit Books</a> | ';
                echo '<a href="?page=wrpr-manage-readers&duplicate=' . esc_attr( $reader['id'] ) . '">Duplicate</a> | ';
                echo '<a href="' . esc_url( $delete_url ) . '">Delete</a></td>';
                echo '</tr>';
            }
            echo '</tbody></table>';
        }
        echo '</div>';
    }
}

if ( isset($_GET['page']) && $_GET['page'] === 'wrpr-edit' && isset($_GET['reader_id']) ) {
    require_once WRPR_PATH . 'includes/wrpr-admin-edit.php';
    WRPR_Admin_Edit::render_edit_page( sanitize_text_field($_GET['reader_id']) );
    return;
}
