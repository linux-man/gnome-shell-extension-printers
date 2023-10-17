import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MyExtensionPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();
        window.title = _('Printers');
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup();
        //Interface
        let model = new Gtk.StringList();
        model.append(_('Gnome Control Center'));
        model.append(_('system-config-printer'));
        let combo = new Adw.ComboRow({
            title: _('Interface'),
            model: model,
            selected: window._settings.get_enum('connect-to')
        });
        combo.connect('notify::selected', (widget)=>{
            window._settings.set_enum('connect-to', widget.selected);
        });
        group.add(combo);
        //Show icon
        model = new Gtk.StringList();
        model.append(_('Always'));
        model.append(_('When printers exist'));
        model.append(_('When printing'));
        combo = new Adw.ComboRow({
            title: _('Show icon'),
            model: model,
            selected: window._settings.get_enum('show-icon')
        });
        combo.connect('notify::selected', (widget)=>{
            window._settings.set_enum('show-icon', widget.selected);
        });
        group.add(combo);
        //show-error
        let check = new Adw.SwitchRow({title: _('Show printer error icon')});
        window._settings.bind('show-error', check, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(check);
        //show-jobs
        check = new Adw.SwitchRow({title: _('Show documents count next to icon')});
        window._settings.bind('show-jobs', check, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(check);
        //job-number
        check = new Adw.SwitchRow({title: _('Show each document number on print list')});
        window._settings.bind('job-number', check, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(check);
        //send-to-front
        check = new Adw.SwitchRow({title: _('Documents can be sent to front')});
        window._settings.bind('send-to-front', check, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(check);
        page.add(group);
        window.add(page);
    }
}

