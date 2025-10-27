<?php
/**
 * Admin functionality for the Wisdom Rain PDF Reader plugin.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once WRPR_PATH . 'includes/wrpr-admin-categories.php';

class WRPR_Admin {

    /**
     * Bootstrap admin-only functionality.
     *
     * @return void
     */
    public static function init() {
        add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
    }

    /**
     * Register the admin menu page and sub-pages.
     *
     * @return void
     */
    public static function register_menu() {
        add_menu_page(
            __( 'WRPR PDF Engine', 'wrpr' ),
            __( 'WRPR PDF Engine', 'wrpr' ),
            'manage_options',
            'wrpr-overview',
            array( __CLASS__, 'render_overview' ),
            'dashicons-book-alt',
            6
        );

        add_submenu_page(
            'wrpr-overview',
            __( 'Manage Readers', 'wrpr' ),
            __( 'Manage Readers', 'wrpr' ),
            'manage_options',
            'wrpr-manage-readers',
            array( __CLASS__, 'render_manage_readers' )
        );

        add_submenu_page(
            'wrpr-overview',
            __( 'Manage Categories', 'wrpr' ),
            __( 'Manage Categories', 'wrpr' ),
            'manage_options',
            'wrpr-manage-categories',
            array( __CLASS__, 'render_manage_categories' )
        );

        add_submenu_page(
            null,
            __( 'Edit Books', 'wrpr' ),
            __( 'Edit Books', 'wrpr' ),
            'manage_options',
            'wrpr-edit',
            array( __CLASS__, 'render_edit_books' )
        );
    }

    /**
     * Render the overview page content.
     *
     * @return void
     */
    public static function render_overview() {
        $template = trailingslashit( WRPR_PATH ) . 'templates/frontend-reader.php';

        if ( file_exists( $template ) ) {
            include $template;
            return;
        }

        self::output_overview_markup();
    }

    /**
     * Render the manage readers page.
     *
     * @return void
     */
    public static function render_manage_readers() {
        require_once WRPR_PATH . 'includes/wrpr-admin-readers.php';
        WRPR_Admin_Readers::render_page();
    }

    /**
     * Render the manage categories page.
     *
     * @return void
     */
    public static function render_manage_categories() {
        WRPR_Admin_Categories::render_page();
    }

    /**
     * Render the hidden edit books page.
     *
     * @return void
     */
    public static function render_edit_books() {
        require_once WRPR_PATH . 'includes/wrpr-admin-edit.php';

        if ( isset( $_GET['reader_id'] ) ) {
            WRPR_Admin_Edit::render_edit_page( sanitize_text_field( wp_unslash( $_GET['reader_id'] ) ) );
            return;
        }

        echo '<div class="wrap"><h1>' . esc_html__( 'No Reader ID provided.', 'wrpr' ) . '</h1></div>';
    }

    /**
     * Output fallback markup if the overview template is missing.
     *
     * @return void
     */
    private static function output_overview_markup() {
        echo '<div class="wrap">';
        echo '<h1>' . esc_html__( 'Wisdom Rain PDF Reader', 'wrpr' ) . '</h1>';
        echo '<p>' . esc_html__( 'Hello WRPR Engine – Plugin successfully loaded.', 'wrpr' ) . '</p>';
        echo '<a class="button button-primary" href="' . esc_url( admin_url( 'admin.php?page=wrpr-manage-readers' ) ) . '">';
        echo esc_html__( 'Manage Readers', 'wrpr' );
        echo '</a> ';
        echo '<a class="button" href="' . esc_url( admin_url( 'admin.php?page=wrpr-manage-categories' ) ) . '">';
        echo esc_html__( 'Manage Categories', 'wrpr' );
        echo '</a>';
        echo '</div>';
    }
}
