<?php
/**
 * Default admin page template for the Wisdom Rain PDF Reader plugin.
 */
?>
<div class="wrap">
    <h1><?php esc_html_e( 'Wisdom Rain PDF Reader', 'wrpr' ); ?></h1>
    <p><?php esc_html_e( 'Hello WRPR Engine – Plugin successfully loaded.', 'wrpr' ); ?></p>
    <p>
        <a class="button button-primary" href="<?php echo esc_url( admin_url( 'admin.php?page=wrpr-manage-readers' ) ); ?>">
            <?php esc_html_e( 'Manage Readers', 'wrpr' ); ?>
        </a>
        <a class="button" href="<?php echo esc_url( admin_url( 'admin.php?page=wrpr-manage-categories' ) ); ?>">
            <?php esc_html_e( 'Manage Categories', 'wrpr' ); ?>
        </a>
    </p>
</div>
